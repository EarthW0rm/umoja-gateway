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

@Injectable()
export class TokenHandler {
  private accessTokenLifetime: number;
  private grantTypes: Record<string, GrantTypeImpl>;
  private oauthRepository: AuthRepository | Record<string, any>;
  private refreshTokenLifetime: number;
  private allowExtendedTokenAttributes?: boolean;
  private requireClientAuthentication: Record<string, boolean>;
  private alwaysIssueNewRefreshToken: boolean;

  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS) options: ServerOptions,
    authCodeGrant: AuthorizationCodeGrantType,
    clientCredentialsGrant: ClientCredentialsGrantType,
    passwordGrant: PasswordGrantType,
    refreshTokenGrant: RefreshTokenGrantType,
    @Inject(AUTH_REPOSITORY) oauthRepository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!oauthRepository.getClient) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getClient()`');
    }

    this.accessTokenLifetime = accessTokenLifetime;
    this.grantTypes = {
      authorization_code: authCodeGrant,
      client_credentials: clientCredentialsGrant,
      password: passwordGrant,
      refresh_token: refreshTokenGrant,
      ...(tokenOptions.extendedGrantTypes ?? {}),
    } as Record<string, GrantTypeImpl>;
    this.oauthRepository = oauthRepository;
    this.refreshTokenLifetime = refreshTokenLifetime;
    this.allowExtendedTokenAttributes = tokenOptions.allowExtendedTokenAttributes;
    this.requireClientAuthentication = tokenOptions.requireClientAuthentication ?? {};
    this.alwaysIssueNewRefreshToken = tokenOptions.alwaysIssueNewRefreshToken !== false;
  }

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
      const client = await (this.oauthRepository as any).getClient(
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
        model: this.oauthRepository,
        refreshTokenLifetime,
        alwaysIssueNewRefreshToken: this.alwaysIssueNewRefreshToken,
      });
      if (instance?.handle) {
        return instance.handle(request, client);
      }
    }

    throw new ServerException('Server error: unsupported grant type handler');
  }

  getAccessTokenLifetime(client: OAuthClient) {
    return client.accessTokenLifetime ?? this.accessTokenLifetime;
  }

  getRefreshTokenLifetime(client: OAuthClient) {
    return client.refreshTokenLifetime ?? this.refreshTokenLifetime;
  }

  getTokenType(model: TokenModel) {
    return new BearerTokenType(
      model.accessToken,
      model.accessTokenLifetime,
      model.refreshToken,
      model.scope,
      model.customAttributes,
    );
  }

  updateSuccessResponse(response: FastifyReply, tokenType: BearerTokenType) {
    const body = tokenType.valueOf();
    if (body?.scope) {
      body.scope = (body.scope as string[]).join(' ');
    }
    response.header('Cache-Control', 'no-store');
    response.header('Pragma', 'no-cache');
    response.status(200).send(body);
  }

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

  isClientAuthenticationRequired(grantType?: string) {
    if (Object.keys(this.requireClientAuthentication).length > 0) {
      return this.requireClientAuthentication[grantType ?? ''] ?? true;
    }
    return true;
  }

  private getHeader(request: FastifyRequest, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value as string | undefined;
  }
}
