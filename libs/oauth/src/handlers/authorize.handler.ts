import { isFormat } from '../utils/formats.util';
import { parse as parseUrl, format as formatUrl, UrlWithParsedQuery } from 'url';
import {
  AccessDeniedException,
  InvalidArgumentException,
  InvalidClientException,
  InvalidRequestException,
  InvalidScopeException,
  ServerException,
  UnauthorizedClientException,
  UnsupportedResponseTypeException,
} from '../exceptions';
import { UmojaException } from '@core/core';
import { parseScope } from '../utils/scope.util';
import { generateRandomToken } from '../utils/token.util';
import { CodeResponseType } from '../response-types/code-response-type';
import * as pkce from '../utils/pkce/pkce.util';
import type { OAuthClient, OAuthUser, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AuthenticateHandler } from './authenticate.handler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';

const responseTypes = {
  code: CodeResponseType,
};

/**
 * Handles OAuth 2.0 authorization code flows including PKCE validation.
 */
@Injectable()
export class AuthorizeHandler {
  private allowEmptyState?: boolean;
  private authenticateHandler: { handle: (request: FastifyRequest, response: FastifyReply) => Promise<OAuthUser> };
  private authorizationCodeLifetime: number;
  private oauthRepository: AuthRepository | Record<string, any>;

  /**
   * Builds an authorize handler capable of issuing authorization codes.
   * @param options Input payload with handler hooks and timing options.
   * @param authenticateHandler Input payload delegating user authentication.
   * @param oauthRepository Input payload repository implementing OAuth flows.
   * @throws {InvalidArgumentException} When required operations are missing.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions & {
      authenticateHandler?: { handle: (request: FastifyRequest, response: FastifyReply) => Promise<OAuthUser> };
      allowEmptyState?: boolean;
      authorizationCodeLifetime?: number;
    },
    authenticateHandler: AuthenticateHandler,
    @Inject(AUTH_REPOSITORY) oauthRepository: AuthRepository,
  ) {
    if (options.authenticateHandler && !options.authenticateHandler.handle) {
      throw new InvalidArgumentException('Invalid argument: authenticateHandler does not implement `handle()`');
    }

    const model = oauthRepository as AuthRepository | Record<string, any>;

    if (!model.getClient) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getClient()`');
    }

    if (!model.saveAuthorizationCode) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `saveAuthorizationCode()`');
    }

    this.allowEmptyState = options.allowEmptyState ?? false;
    this.authenticateHandler = options.authenticateHandler ?? authenticateHandler;
    if (!this.authenticateHandler) {
      throw new InvalidArgumentException('Missing parameter: `authenticateHandler`');
    }
    this.authorizationCodeLifetime = options.authorizationCodeLifetime ?? 5 * 60;
    this.oauthRepository = model;
  }

  /**
   * Orchestrates the authorization code issuance and redirect response.
   * @param request Input payload containing query/body parameters.
   * @param response Output model used for redirects.
   * @returns The persisted authorization code record.
   * @throws {UmojaException} When validation or persistence fails.
   */
  async handle(request: FastifyRequest, response: FastifyReply) {
    const expiresAt = this.getAuthorizationCodeLifetime();
    const client = await this.getClient(request);
    const user = await this.getUser(request, response);

    let uri: UrlWithParsedQuery | undefined;
    let state: string | undefined;

    try {
      uri = this.getRedirectUri(request, client);
      state = this.getState(request);

      const allowedFlag =
        (request.query as any)?.allowed === 'false' || (request.body as any)?.allowed === 'false';
      if (allowedFlag) {
        throw new AccessDeniedException('Access denied: user denied access to application');
      }

      const requestedScope = this.getScope(request);
      const validScope = await this.validateScope(user, client, requestedScope);
      const authorizationCode = await this.generateAuthorizationCode(client, user, validScope);
      const ResponseType = this.getResponseType(request);
      const codeChallenge = this.getCodeChallenge(request);
      const codeChallengeMethod = this.getCodeChallengeMethod(request);
      const code = await this.saveAuthorizationCode(
        authorizationCode,
        expiresAt,
        validScope,
        client,
        uri,
        user,
        codeChallenge,
        codeChallengeMethod,
      );

      const responseTypeInstance = new ResponseType(code.authorizationCode);
      const redirectUri = this.buildSuccessRedirectUri(uri, responseTypeInstance);

      this.updateResponse(response, redirectUri, state);
      return code;
    } catch (error) {
      let resolved = error;
      if (!(resolved instanceof UmojaException)) {
        const message = resolved instanceof Error ? resolved.message : 'Server error';
        resolved = new ServerException(message, resolved as Error);
      }
      const redirectUri = this.buildErrorRedirectUri(uri, resolved as UmojaException);
      this.updateResponse(response, redirectUri, state);
      throw resolved;
    }
  }

  /**
   * Generates an authorization code using repository hook or a random token.
   * @param client Input payload representing the OAuth client.
   * @param user Input payload representing the resource owner.
   * @param scope Optional scope array.
   * @returns The generated code string.
   */
  async generateAuthorizationCode(client: OAuthClient, user: OAuthUser, scope?: string[]) {
    if ((this.oauthRepository as any).generateAuthorizationCode) {
      return (this.oauthRepository as any).generateAuthorizationCode(client, user, scope);
    }
    return generateRandomToken();
  }

  /**
   * Computes the expiration timestamp for a new authorization code.
   * @returns Expiration date for the code.
   */
  getAuthorizationCodeLifetime() {
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + this.authorizationCodeLifetime);
    return expires;
  }

  /**
   * Resolves and validates the OAuth client from the request payload.
   * @param request Input payload containing client identifiers.
   * @returns The validated OAuth client.
   * @throws {InvalidRequestException | InvalidClientException | UnauthorizedClientException}
   */
  async getClient(request: FastifyRequest): Promise<OAuthClient> {
    const clientId =
      (request.body as any)?.client_id as string | undefined ?? (request.query as any)?.client_id;
    if (!clientId) {
      throw new InvalidRequestException('Missing parameter: `client_id`');
    }

    if (!isFormat.vschar(clientId)) {
      throw new InvalidRequestException('Invalid parameter: `client_id`');
    }

    const redirectUri =
      (request.body as any)?.redirect_uri as string | undefined ?? (request.query as any)?.redirect_uri;
    if (redirectUri && !isFormat.uri(redirectUri)) {
      throw new InvalidRequestException('Invalid request: `redirect_uri` is not a valid URI');
    }

    const client = await (this.oauthRepository as any).getClient(clientId, null);
    if (!client) {
      throw new InvalidClientException('Invalid client: client credentials are invalid');
    }

    if (!client.grants) {
      throw new InvalidClientException('Invalid client: missing client `grants`');
    }

    const grants = Array.isArray(client.grants) ? client.grants : [client.grants];
    if (!grants.includes('authorization_code')) {
      throw new UnauthorizedClientException('Unauthorized client: `grant_type` is invalid');
    }

    if (!client.redirectUris || (Array.isArray(client.redirectUris) && client.redirectUris.length === 0)) {
      throw new InvalidClientException('Invalid client: missing client `redirectUri`');
    }

    if (redirectUri) {
      const valid = await this.validateRedirectUri(redirectUri, client);
      if (!valid) {
        throw new InvalidClientException('Invalid client: `redirect_uri` does not match client value');
      }
    }

    return client;
  }

  /**
   * Validates the requested scope using repository hook when available.
   * @param user Input payload representing the resource owner.
   * @param client Input payload representing the OAuth client.
   * @param scope Parsed scope array.
   * @returns The validated scope array.
   * @throws {InvalidScopeException}
   */
  async validateScope(user: OAuthUser, client: OAuthClient, scope?: string[]) {
    if ((this.oauthRepository as any).validateScope) {
      const validatedScope = await (this.oauthRepository as any).validateScope(user, client, scope);
      if (!validatedScope) {
        throw new InvalidScopeException('Invalid scope: Requested scope is invalid');
      }
      return validatedScope;
    }

    return scope;
  }

  /**
   * Parses scope from request body or query string.
   * @param request Input payload containing scope.
   * @returns Scope as string array or undefined.
   */
  getScope(request: FastifyRequest) {
    const scope = (request.body as any)?.scope as string | undefined ?? (request.query as any)?.scope;
    return parseScope(scope);
  }

  /**
   * Extracts and validates the state parameter when required.
   * @param request Input payload containing state.
   * @returns The provided state or undefined.
   * @throws {InvalidRequestException}
   */
  getState(request: FastifyRequest) {
    const state = (request.body as any)?.state as string | undefined ?? (request.query as any)?.state;
    const stateExists = !!state && state.length > 0;
    const stateIsValid = stateExists ? isFormat.vschar(state) : this.allowEmptyState;

    if (!stateIsValid) {
      const message = !stateExists ? 'Missing' : 'Invalid';
      throw new InvalidRequestException(`${message} parameter: \`state\``);
    }

    return state;
  }

  /**
   * Retrieves the authenticated user using the configured handler.
   * @param request Input payload with authentication data.
   * @param response Output model for downstream handlers.
   * @returns The authenticated user model.
   * @throws {ServerException}
   */
  async getUser(request: FastifyRequest, response: FastifyReply): Promise<OAuthUser> {
    const user = await this.authenticateHandler.handle(request, response);
    if (!user) {
      throw new ServerException('Server error: `handle()` did not return a `user` object');
    }
    return user;
  }

  /**
   * Resolves the redirect URI from the request or client configuration.
   * @param request Input payload containing redirect hints.
   * @param client Input payload representing the OAuth client.
   * @returns Parsed redirect URI.
   * @throws {InvalidClientException}
   */
  getRedirectUri(request: FastifyRequest, client: OAuthClient) {
    const redirectUri =
      (request.body as any)?.redirect_uri as string | undefined ?? (request.query as any)?.redirect_uri;
    const redirectUris = Array.isArray(client.redirectUris) ? client.redirectUris : [client.redirectUris];
    const resolvedRedirect = redirectUri ?? redirectUris[0];
    if (!resolvedRedirect) {
      throw new InvalidClientException('Invalid client: missing client `redirectUri`');
    }
    return parseUrl(resolvedRedirect, true);
  }

  /**
   * Persists the authorization code using repository operation.
   * @param authorizationCode Generated code string.
   * @param expiresAt Expiration date of the code.
   * @param scope Scope attached to the code.
   * @param client Input payload representing the OAuth client.
   * @param redirectUri Redirect URI to enforce.
   * @param user Input payload representing the resource owner.
   * @param codeChallenge Optional PKCE code challenge.
   * @param codeChallengeMethod Optional PKCE method.
   * @returns Persisted code record.
   */
  async saveAuthorizationCode(
    authorizationCode: string,
    expiresAt: Date,
    scope: string[] | undefined,
    client: OAuthClient,
    redirectUri: UrlWithParsedQuery,
    user: OAuthUser,
    codeChallenge?: string,
    codeChallengeMethod?: string,
  ) {
    let code: {
      authorizationCode: string;
      expiresAt: Date;
      redirectUri: string;
      scope: string[] | undefined;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    } = {
      authorizationCode,
      expiresAt,
      redirectUri: formatUrl(redirectUri),
      scope,
    };

    if (codeChallenge && codeChallengeMethod) {
      code = {
        codeChallenge,
        codeChallengeMethod,
        ...code,
      };
    }

    return (this.oauthRepository as any).saveAuthorizationCode(code, client, user);
  }

  /**
   * Validates redirect URI against repository hook or client configuration.
   * @param redirectUri Redirect URI sent by the client.
   * @param client Input payload representing the OAuth client.
   * @returns True when valid, false otherwise.
   */
  async validateRedirectUri(redirectUri: string, client: OAuthClient) {
    if ((this.oauthRepository as any).validateRedirectUri) {
      return (this.oauthRepository as any).validateRedirectUri(redirectUri, client);
    }

    const redirectUris = Array.isArray(client.redirectUris) ? client.redirectUris : [client.redirectUris];
    return redirectUris.includes(redirectUri);
  }

  /**
   * Selects the response type handler based on request parameter.
   * @param request Input payload containing response_type.
   * @returns The response type class.
   * @throws {InvalidRequestException | UnsupportedResponseTypeException}
   */
  getResponseType(request: FastifyRequest) {
    const responseType =
      (request.body as any)?.response_type as string | undefined ?? (request.query as any)?.response_type;
    if (!responseType) {
      throw new InvalidRequestException('Missing parameter: `response_type`');
    }

    if (!Object.prototype.hasOwnProperty.call(responseTypes, responseType)) {
      throw new UnsupportedResponseTypeException('Unsupported response type: `response_type` is not supported');
    }

    return responseTypes[responseType];
  }

  /**
   * Builds success redirect URI with authorization code params.
   * @param redirectUri Parsed redirect URI.
   * @param responseType Response type instance.
   * @returns Redirect URI string with query params.
   */
  buildSuccessRedirectUri(redirectUri: UrlWithParsedQuery, responseType: CodeResponseType) {
    return responseType.buildRedirectUri(formatUrl(redirectUri));
  }

  /**
   * Builds error redirect URI embedding the error details.
   * @param redirectUri Parsed redirect URI or undefined.
   * @param error Input payload representing the OAuth error.
   * @returns Redirect URI with error details.
   * @throws {UmojaException} When no redirect URI is available.
   */
  buildErrorRedirectUri(redirectUri: UrlWithParsedQuery | undefined, error: UmojaException) {
    if (!redirectUri) {
      throw error;
    }

    const uri = parseUrl(formatUrl(redirectUri), true);
    const responsePayload = error.getResponse();
    const errorCode =
      typeof responsePayload === 'object' && responsePayload !== null && 'code' in responsePayload
        ? (responsePayload as { code: string }).code
        : error.name;
    uri.query = {
      error: errorCode,
    };
    if (error.message) {
      uri.query.error_description = error.message;
    }

    return uri;
  }

  /**
   * Issues the redirect response to the client with optional state.
   * @param response Output model used to send redirect.
   * @param redirectUri Redirect target with query params.
   * @param state Optional state to echo back.
   */
  updateResponse(response: FastifyReply, redirectUri: UrlWithParsedQuery, state?: string) {
    redirectUri.query = redirectUri.query || {};
    if (state) {
      redirectUri.query.state = state;
    }
    response.redirect(formatUrl(redirectUri));
  }

  /**
   * Reads the PKCE code challenge from request.
   * @param request Input payload containing PKCE parameters.
   * @returns Code challenge or undefined.
   */
  getCodeChallenge(request: FastifyRequest) {
    return (
      (request.body as any)?.code_challenge as string | undefined ??
      (request.query as any)?.code_challenge
    );
  }

  /**
   * Validates PKCE code challenge method and falls back to plain.
   * @param request Input payload containing PKCE parameters.
   * @returns The PKCE transformation method.
   * @throws {InvalidRequestException}
   */
  getCodeChallengeMethod(request: FastifyRequest) {
    const algorithm =
      ((request.body as any)?.code_challenge_method as string | undefined) ??
      (request.query as any)?.code_challenge_method;

    if (algorithm && !pkce.isValidMethod(algorithm)) {
      throw new InvalidRequestException(`Invalid request: transform algorithm '${algorithm}' not supported`);
    }

    return algorithm ?? 'plain';
  }
}
