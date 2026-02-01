import { Inject, Injectable } from '@nestjs/common';
import { isFormat } from '../utils/formats.util';
import {
  InvalidArgumentException,
  InvalidClientException,
  InvalidRequestException,
  ServerException,
  UnauthorizedClientException,
  UnsupportedGrantTypeException,
} from '../exceptions';
import { UmojaException } from '@core/core';
import { TokenModel } from '../models/token.model';
import { BearerTokenType } from '../token-types/bearer-token-type';
import * as pkce from '../utils/pkce/pkce.util';
import type { GrantTypeConstructor, OAuthClient, OAuthToken, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { parseBasicAuth } from '../utils/basic-auth.util';
import {
  AuthorizationCodeGrantType,
  ClientCredentialsGrantType,
  PasswordGrantType,
  RefreshTokenGrantType,
} from '../grant-types';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { typeIs } from '../utils';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

type GrantTypeImpl = { handle: (request: any, client: any) => Promise<any> } | GrantTypeConstructor;

/**
 * Handles OAuth 2.0 token issuance for multiple grant types.
 */
@Injectable()
export class TokenHandler {
  private accessTokenLifetime: number;
  private grantTypes: Record<string, GrantTypeImpl>;
  private authRepository: AuthRepository | Record<string, any>;
  private refreshTokenLifetime: number;
  private allowExtendedTokenAttributes?: boolean;
  private requireClientAuthentication: Record<string, boolean>;
  private alwaysIssueNewRefreshToken: boolean;

  /**
   * Builds a token handler with supported grant type implementations.
   * @param options Input payload containing token lifetimes and flags.
   * @param authCodeGrant Input payload handler for authorization_code grant.
   * @param clientCredentialsGrant Input payload handler for client_credentials grant.
   * @param passwordGrant Input payload handler for password grant.
   * @param refreshTokenGrant Input payload handler for refresh_token grant.
   * @param authRepository Input payload repository implementing OAuth operations.
   * @throws {InvalidArgumentException} When repository lacks required operations.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS) options: ServerOptions,
    authCodeGrant: AuthorizationCodeGrantType,
    clientCredentialsGrant: ClientCredentialsGrantType,
    passwordGrant: PasswordGrantType,
    refreshTokenGrant: RefreshTokenGrantType,
    @Inject(AUTH_REPOSITORY) authRepository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!authRepository.getClient) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `getClient()`');
    }

    this.accessTokenLifetime = accessTokenLifetime;
    this.grantTypes = {
      authorization_code: authCodeGrant,
      client_credentials: clientCredentialsGrant,
      password: passwordGrant,
      refresh_token: refreshTokenGrant,
      ...(tokenOptions.extendedGrantTypes ?? {}),
    } as Record<string, GrantTypeImpl>;
    this.authRepository = authRepository;
    this.refreshTokenLifetime = refreshTokenLifetime;
    this.allowExtendedTokenAttributes = tokenOptions.allowExtendedTokenAttributes;
    this.requireClientAuthentication = tokenOptions.requireClientAuthentication ?? {};
    this.alwaysIssueNewRefreshToken = tokenOptions.alwaysIssueNewRefreshToken !== false;
  }

  /**
   * Processes a token request for the configured grant types.
   * @param request Input payload containing grant parameters.
   * @param reply Output model used to return token or error payload.
   * @returns The issued token payload.
   * @throws {InvalidRequestException | UmojaException}
   */
  async handle(request: FastifyRequest, reply: FastifyReply) {
    if (request.method !== 'POST') {
      throw new InvalidRequestException('Invalid request: method must be POST');
    }

    if (
      !typeIs(this.getHeader(request, 'content-type') ?? undefined, 'application/x-www-form-urlencoded')
    ) {
      throw new InvalidRequestException('Invalid request: content must be application/x-www-form-urlencoded');
    }

    try {
      const client = await this.getClient(request, reply);
      const data = await this.handleGrantType(request, client);
      const model = new TokenModel(data as OAuthToken, {
        allowExtendedTokenAttributes: this.allowExtendedTokenAttributes,
      });
      const tokenType = this.getTokenType(model);
      this.updateSuccessResponse(reply, tokenType);
      return data;
    } catch (err) {
      let resolved = err;
      if (!(resolved instanceof UmojaException)) {
        const message = resolved instanceof Error ? resolved.message : 'Server error';
        resolved = new ServerException(message, resolved as Error);
      }
      this.updateErrorResponse(reply, resolved as UmojaException);
      throw resolved;
    }
  }

  /**
   * Resolves and validates the OAuth client from provided credentials.
   * @param request Input payload containing credentials.
   * @param response Output model for auth challenge headers.
   * @returns The validated client model.
   * @throws {InvalidRequestException | InvalidClientException | ServerException}
   */
  async getClient(request: FastifyRequest, response: FastifyReply) {
    const credentials = this.getClientCredentials(request);
    const grantType = (request.body as any)?.grant_type as string | undefined;
    const codeVerifier = (request.body as any)?.code_verifier as string | undefined;
    const isPkce = pkce.isPKCERequest({ grantType, codeVerifier });

    if (!credentials.clientId) {
      throw new InvalidRequestException('Missing parameter: `client_id`');
    }

    if (this.isClientAuthenticationRequired(grantType) && !credentials.clientSecret && !isPkce) {
      throw new InvalidRequestException('Missing parameter: `client_secret`');
    }

    if (!isFormat.vschar(credentials.clientId)) {
      throw new InvalidRequestException('Invalid parameter: `client_id`');
    }

    if (credentials.clientSecret && !isFormat.vschar(credentials.clientSecret)) {
      throw new InvalidRequestException('Invalid parameter: `client_secret`');
    }

    try {
      const client = await (this.authRepository as any).getClient(
        credentials.clientId,
        credentials.clientSecret ?? null,
      );
      if (!client) {
        throw new InvalidClientException('Invalid client: client is invalid');
      }

      if (!client.grants) {
        throw new ServerException('Server error: missing client `grants`');
      }

      const grants = Array.isArray(client.grants) ? client.grants : [client.grants];
      /* istanbul ignore if -- grants is always array from ternary above; defensive check */
      if (!Array.isArray(grants)) {
        throw new ServerException('Server error: `grants` must be an array');
      }

      return client;
    } catch (error) {
      if (error instanceof InvalidClientException && this.getHeader(request, 'authorization')) {
        response.header('WWW-Authenticate', 'Basic realm="Service"');
        const message = error instanceof Error ? error.message : 'Invalid client';
        throw new InvalidClientException(message, error as Error);
      }
      throw error;
    }
  }

  /**
   * Extracts client credentials from Authorization header or request body.
   * @param request Input payload containing headers and body.
   * @returns Object with clientId and optional clientSecret.
   * @throws {InvalidClientException}
   */
  getClientCredentials(request: FastifyRequest) {
    const credentials = parseBasicAuth({
      headers: request.headers ?? {},
    });
    const grantType = (request.body as any)?.grant_type as string | undefined;
    const codeVerifier = (request.body as any)?.code_verifier as string | undefined;

    if (credentials) {
      return { clientId: credentials.name, clientSecret: credentials.pass };
    }

    if ((request.body as any)?.client_id && (request.body as any)?.client_secret) {
      return {
        clientId: (request.body as any).client_id as string,
        clientSecret: (request.body as any).client_secret as string,
      };
    }

    if (pkce.isPKCERequest({ grantType, codeVerifier })) {
      if ((request.body as any)?.client_id) {
        return { clientId: (request.body as any).client_id as string };
      }
    }

    if (!this.isClientAuthenticationRequired(grantType)) {
      if ((request.body as any)?.client_id) {
        return { clientId: (request.body as any).client_id as string };
      }
    }

    throw new InvalidClientException('Invalid client: cannot retrieve client credentials');
  }

  /**
   * Handles the selected grant type and issues tokens.
   * @param request Input payload containing grant details.
   * @param client Input payload representing the OAuth client.
   * @returns Token payload from the grant handler.
   * @throws {InvalidRequestException | UnsupportedGrantTypeException | UnauthorizedClientException | ServerException}
   */
  async handleGrantType(request: FastifyRequest, client: OAuthClient) {
    const grantType = (request.body as any)?.grant_type as string | undefined;
    if (!grantType) {
      throw new InvalidRequestException('Missing parameter: `grant_type`');
    }

    if (!isFormat.nchar(grantType) && !isFormat.uri(grantType)) {
      throw new InvalidRequestException('Invalid parameter: `grant_type`');
    }

    if (!Object.prototype.hasOwnProperty.call(this.grantTypes, grantType)) {
      throw new UnsupportedGrantTypeException('Unsupported grant type: `grant_type` is invalid');
    }

    const grants = Array.isArray(client.grants) ? client.grants : [client.grants];
    if (!grants.includes(grantType)) {
      throw new UnauthorizedClientException('Unauthorized client: `grant_type` is invalid');
    }

    const accessTokenLifetime = this.getAccessTokenLifetime(client);
    const refreshTokenLifetime = this.getRefreshTokenLifetime(client);
    const Type = this.grantTypes[grantType];

    if (Type && typeof (Type as any).handle === 'function') {
      return (Type as any).handle(request, client);
    }

    if (typeof Type === 'function') {
      const instance = new (Type as any)({
        accessTokenLifetime,
        authRepository: this.authRepository,
        refreshTokenLifetime,
        alwaysIssueNewRefreshToken: this.alwaysIssueNewRefreshToken,
      });
      if (instance?.handle) {
        return instance.handle(request, client);
      }
    }

    throw new ServerException('Server error: unsupported grant type handler');
  }

  /**
   * Resolves access token lifetime using client override or defaults.
   * @param client Input payload representing the OAuth client.
   * @returns Lifetime in seconds.
   */
  getAccessTokenLifetime(client: OAuthClient) {
    return client.accessTokenLifetime ?? this.accessTokenLifetime;
  }

  /**
   * Resolves refresh token lifetime using client override or defaults.
   * @param client Input payload representing the OAuth client.
   * @returns Lifetime in seconds.
   */
  getRefreshTokenLifetime(client: OAuthClient) {
    return client.refreshTokenLifetime ?? this.refreshTokenLifetime;
  }

  /**
   * Builds the bearer token type wrapper for the issued token model.
   * @param model Input payload representing the issued token model.
   * @returns Bearer token type instance.
   */
  getTokenType(model: TokenModel) {
    return new BearerTokenType(
      model.accessToken,
      model.accessTokenLifetime,
      model.refreshToken,
      model.scope,
      model.customAttributes,
    );
  }

  /**
   * Sends a successful token response with cache headers.
   * @param response Output model used to send payload.
   * @param tokenType Token type instance to serialize.
   */
  updateSuccessResponse(response: FastifyReply, tokenType: BearerTokenType) {
    const body = tokenType.valueOf();
    if (body?.scope) {
      body.scope = (body.scope as string[]).join(' ');
    }
    response.header('Cache-Control', 'no-store');
    response.header('Pragma', 'no-cache');
    response.status(200).send(body);
  }

  /**
   * Sends an OAuth-compliant error response.
   * @param response Output model used to send payload.
   * @param error Input payload representing the OAuth error.
   */
  updateErrorResponse(response: FastifyReply, error: UmojaException) {
    const responsePayload = error.getResponse();
    const errorCode =
      typeof responsePayload === 'object' && responsePayload !== null && 'code' in responsePayload
        ? (responsePayload as { code: string }).code
        : error.name;
    const body = {
      error: errorCode,
      error_description: error.message,
    };
    response.status(error.getStatus()).send(body);
  }

  /**
   * Determines whether client authentication is required for the grant type.
   * @param grantType Grant type identifier.
   * @returns True when authentication is required.
   */
  isClientAuthenticationRequired(grantType?: string) {
    if (Object.keys(this.requireClientAuthentication).length > 0) {
      return this.requireClientAuthentication[grantType ?? ''] ?? true;
    }
    return true;
  }

  /**
   * Retrieves a header value from the Fastify request in a normalized way.
   * @param request Input payload containing HTTP headers.
   * @param name Header name to fetch.
   * @returns Header value or undefined.
   */
  private getHeader(request: FastifyRequest, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    /* istanbul ignore next -- both branches exercised; coverage tool may not distinguish */
    return value as string | undefined;
  }
}
