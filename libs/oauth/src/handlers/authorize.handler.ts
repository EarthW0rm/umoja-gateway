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

@Injectable()
export class AuthorizeHandler {
  private allowEmptyState?: boolean;
  private authenticateHandler: { handle: (request: FastifyRequest, response: FastifyReply) => Promise<OAuthUser> };
  private authorizationCodeLifetime: number;
  private oauthRepository: AuthRepository | Record<string, any>;

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

  async generateAuthorizationCode(client: OAuthClient, user: OAuthUser, scope?: string[]) {
    if ((this.oauthRepository as any).generateAuthorizationCode) {
      return (this.oauthRepository as any).generateAuthorizationCode(client, user, scope);
    }
    return generateRandomToken();
  }

  getAuthorizationCodeLifetime() {
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + this.authorizationCodeLifetime);
    return expires;
  }

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

  getScope(request: FastifyRequest) {
    const scope = (request.body as any)?.scope as string | undefined ?? (request.query as any)?.scope;
    return parseScope(scope);
  }

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

  async getUser(request: FastifyRequest, response: FastifyReply): Promise<OAuthUser> {
    const user = await this.authenticateHandler.handle(request, response);
    if (!user) {
      throw new ServerException('Server error: `handle()` did not return a `user` object');
    }
    return user;
  }

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

  async validateRedirectUri(redirectUri: string, client: OAuthClient) {
    if ((this.oauthRepository as any).validateRedirectUri) {
      return (this.oauthRepository as any).validateRedirectUri(redirectUri, client);
    }

    const redirectUris = Array.isArray(client.redirectUris) ? client.redirectUris : [client.redirectUris];
    return redirectUris.includes(redirectUri);
  }

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

  buildSuccessRedirectUri(redirectUri: UrlWithParsedQuery, responseType: CodeResponseType) {
    return responseType.buildRedirectUri(formatUrl(redirectUri));
  }

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

  updateResponse(response: FastifyReply, redirectUri: UrlWithParsedQuery, state?: string) {
    redirectUri.query = redirectUri.query || {};
    if (state) {
      redirectUri.query.state = state;
    }
    response.redirect(formatUrl(redirectUri));
  }

  getCodeChallenge(request: FastifyRequest) {
    return (
      (request.body as any)?.code_challenge as string | undefined ??
      (request.query as any)?.code_challenge
    );
  }

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
