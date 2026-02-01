import {
  InsufficientScopeException,
  InvalidArgumentException,
  InvalidRequestException,
  InvalidTokenException,
  ServerException,
  UnauthorizedRequestException,
} from '../exceptions';
import { UmojaException } from '@core/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseScope } from '../utils/scope.util';
import { typeIs } from '../utils';
import type { JwtTokenOptions, OAuthToken, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions, verifyAccessTokenJwt, mapPayloadToOAuthToken } from '../utils';

/**
 * Validates bearer tokens from incoming requests and enforces configured scopes.
 */
@Injectable()
export class AuthenticateHandler {
  private addAcceptedScopesHeader?: boolean;
  private addAuthorizedScopesHeader?: boolean;
  private allowBearerTokensInQueryString?: boolean;
  private authRepository: AuthRepository | Record<string, any>;
  private scope?: string[];
  private jwtOptions?: JwtTokenOptions;

  /**
   * Builds an authenticate handler with scope and audience validation.
   * @param options Input payload configuring scope, headers, and token options.
   * @param authRepository Input payload repository that provides token operations.
   * @throws {InvalidArgumentException} When repository lacks required operations.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions & {
      scope?: string[] | string;
      addAcceptedScopesHeader?: boolean;
      addAuthorizedScopesHeader?: boolean;
      allowBearerTokensInQueryString?: boolean;
    },
    @Inject(AUTH_REPOSITORY) authRepository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);

    if (!authRepository.getAccessToken) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `getAccessToken()`');
    }

    if (options.scope && !authRepository.verifyScope) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `verifyScope()`');
    }

    this.addAcceptedScopesHeader = options.addAcceptedScopesHeader ?? true;
    this.addAuthorizedScopesHeader = options.addAuthorizedScopesHeader ?? true;
    this.allowBearerTokensInQueryString = options.allowBearerTokensInQueryString ?? false;
    this.authRepository = authRepository;
    this.scope = Array.isArray(options.scope) ? options.scope : parseScope(options.scope);
    this.jwtOptions = tokenOptions.jwt;
  }

  /**
   * Authenticates the request and returns the validated token model.
   * @param request Input payload containing headers, query, and body.
   * @param reply Output model used to set authentication headers.
   * @returns The validated OAuth token.
   * @throws {UnauthorizedRequestException | InvalidRequestException | InvalidTokenException | InsufficientScopeException | ServerException}
   */
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const requestToken = await this.getTokenFromRequest(request);
      let accessToken = await this.getAccessToken(requestToken);
      accessToken = this.validateAccessToken(accessToken);

      if (this.scope) {
        await this.verifyScope(accessToken);
      }

      this.updateResponse(reply, accessToken);
      return accessToken;
    } catch (error) {
      if (error instanceof UnauthorizedRequestException) {
        reply.header('WWW-Authenticate', 'Bearer realm="Service"');
      } else if (error instanceof InvalidRequestException) {
        reply.header('WWW-Authenticate', 'Bearer realm="Service",error="invalid_request"');
      } else if (error instanceof InvalidTokenException) {
        reply.header('WWW-Authenticate', 'Bearer realm="Service",error="invalid_token"');
      } else if (error instanceof InsufficientScopeException) {
        reply.header('WWW-Authenticate', 'Bearer realm="Service",error="insufficient_scope"');
      }

      if (!(error instanceof UmojaException)) {
        const message = error instanceof Error ? error.message : 'Server error';
        throw new ServerException(message, error as Error);
      }

      throw error;
    }
  }

  /**
   * Extracts a bearer token from request headers, query, or body.
   * @param request Input payload to inspect.
   * @returns The raw bearer token value.
   * @throws {InvalidRequestException | UnauthorizedRequestException}
   */
  getTokenFromRequest(request: FastifyRequest) {
    const headerToken = this.getHeader(request, 'authorization');
    const queryToken = (request.query as any)?.access_token as string | undefined;
    const bodyToken = (request.body as any)?.access_token as string | undefined;

    if (Number(!!headerToken) + Number(!!queryToken) + Number(!!bodyToken) > 1) {
      throw new InvalidRequestException('Invalid request: only one authentication method is allowed');
    }

    if (headerToken) {
      return this.getTokenFromRequestHeader(request);
    }

    if (queryToken) {
      return this.getTokenFromRequestQuery(request);
    }

    if (bodyToken) {
      return this.getTokenFromRequestBody(request);
    }

    throw new UnauthorizedRequestException('Unauthorized request: no authentication given');
  }

  /**
   * Reads the bearer token from the Authorization header.
   * @param request Input payload containing headers.
   * @returns The bearer token string.
   * @throws {InvalidRequestException}
   */
  getTokenFromRequestHeader(request: FastifyRequest) {
    const token = this.getHeader(request, 'authorization');
    const matches = token?.match(/^Bearer ([0-9a-zA-Z-._~+/]+=*)$/);

    if (!matches) {
      throw new InvalidRequestException('Invalid request: malformed authorization header');
    }

    return matches[1];
  }

  /**
   * Reads the bearer token from query string when allowed.
   * @param request Input payload containing query params.
   * @returns The bearer token string.
   * @throws {InvalidRequestException}
   */
  getTokenFromRequestQuery(request: FastifyRequest) {
    if (!this.allowBearerTokensInQueryString) {
      throw new InvalidRequestException('Invalid request: do not send bearer tokens in query URLs');
    }

    return (request.query as any)?.access_token as string;
  }

  /**
   * Reads the bearer token from request body for non-GET requests.
   * @param request Input payload containing body data.
   * @returns The bearer token string.
   * @throws {InvalidRequestException}
   */
  getTokenFromRequestBody(request: FastifyRequest) {
    if (request.method === 'GET') {
      throw new InvalidRequestException(
        'Invalid request: token may not be passed in the body when using the GET verb',
      );
    }

    if (!typeIs(this.getHeader(request, 'content-type') ?? undefined, 'application/x-www-form-urlencoded')) {
      throw new InvalidRequestException('Invalid request: content must be application/x-www-form-urlencoded');
    }

    return (request.body as any)?.access_token as string;
  }

  /**
   * Retrieves and optionally verifies an access token using the repository or JWT.
   * @param token Raw bearer token.
   * @returns The hydrated OAuth token model.
   * @throws {InvalidTokenException | ServerException}
   */
  async getAccessToken(token: string): Promise<OAuthToken> {
    if (this.jwtOptions && (this.jwtOptions.publicKey || this.jwtOptions.secret || this.jwtOptions.privateKey)) {
      try {
        const payload = verifyAccessTokenJwt(token, { ...this.jwtOptions, audience: undefined });
        const oauthToken = mapPayloadToOAuthToken(token, payload);
        await this.verifyAudience(oauthToken);
        return oauthToken;
      } catch (err) {
        throw new InvalidTokenException('Invalid token: JWT verification failed', err as Error);
      }
    }

    const accessToken = await this.authRepository.getAccessToken(token);

    if (!accessToken) {
      throw new InvalidTokenException('Invalid token: access token is invalid');
    }

    if (!accessToken.user) {
      throw new ServerException('Server error: `getAccessToken()` did not return a `user` object');
    }

    return accessToken;
  }

  /**
   * Ensures the access token has not expired and contains expected fields.
   * @param accessToken Input payload representing the OAuth token.
   * @returns The validated OAuth token.
   * @throws {ServerException | InvalidTokenException}
   */
  validateAccessToken(accessToken: OAuthToken) {
    if (!(accessToken.accessTokenExpiresAt instanceof Date)) {
      throw new ServerException('Server error: `accessTokenExpiresAt` must be a Date instance');
    }

    if (accessToken.accessTokenExpiresAt < new Date()) {
      throw new InvalidTokenException('Invalid token: access token has expired');
    }

    return accessToken;
  }

  /**
   * Confirms the token scope satisfies the configured requirements.
   * @param accessToken Input payload representing the OAuth token.
   * @throws {InsufficientScopeException}
   */
  async verifyScope(accessToken: OAuthToken) {
    const scope = await this.authRepository.verifyScope?.(accessToken, this.scope);

    if (!scope) {
      throw new InsufficientScopeException('Insufficient scope: authorized scope is insufficient');
    }
  }

  /**
   * Adds OAuth scope headers to the reply when configured.
   * @param reply Output model to mutate headers.
   * @param accessToken Input payload representing the OAuth token.
   */
  updateResponse(reply: FastifyReply, accessToken: OAuthToken) {
    if (accessToken.scope == null) {
      return;
    }

    if (this.scope && this.addAcceptedScopesHeader) {
      reply.header('X-Accepted-OAuth-Scopes', this.scope.join(' '));
    }

    if (this.scope && this.addAuthorizedScopesHeader) {
      reply.header('X-OAuth-Scopes', accessToken.scope?.join(' ') ?? '');
    }
  }

  /**
   * Safely extracts a header value from the Fastify request.
   * @param request Input payload containing the HTTP headers.
   * @param name Header name to resolve.
   * @returns Header value or undefined.
   */
  private getHeader(request: FastifyRequest, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value as string | undefined;
  }

  /**
   * Validates JWT audience against repository-provided audiences.
   * @param accessToken Input payload representing the OAuth token.
   * @throws {InvalidTokenException}
   */
  private async verifyAudience(accessToken: OAuthToken) {
    const authRepo = this.authRepository as AuthRepository & {
      getAudiences?: (client: any, user: any, scope?: string[]) => Promise<string[] | string | null>;
    };

    if (!authRepo.getAudiences) {
      return;
    }

    const clientId = (accessToken.client as { id?: string } | undefined)?.id;
    if (!clientId) {
      throw new InvalidTokenException('Invalid token: missing client identifier');
    }

    const client = await authRepo.getClient(clientId, null);
    if (!client) {
      throw new InvalidTokenException('Invalid token: client is invalid');
    }

    const expectedAudiences = await authRepo.getAudiences(client, accessToken.user, accessToken.scope);
    if (!expectedAudiences) {
      return;
    }

    const allowed = Array.isArray(expectedAudiences) ? expectedAudiences : [expectedAudiences];
    const presented = (accessToken as OAuthToken & { audience?: string[] | string }).audience;
    const presentedArr = Array.isArray(presented)
      ? presented
      : typeof presented === 'string'
        ? presented.split(' ')
        : [];

    const match = presentedArr.some((aud) => allowed.includes(aud));
    if (!match) {
      throw new InvalidTokenException('Invalid token: audience is not allowed');
    }
  }
}
