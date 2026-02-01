import { Inject, Injectable } from '@nestjs/common';
import { isFormat } from '../utils/formats.util';
import {
  InvalidArgumentException,
  InvalidGrantException,
  InvalidRequestException,
  InvalidScopeException,
  ServerException,
} from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, RefreshToken, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

@Injectable()
export class RefreshTokenGrantType extends AbstractGrantType {
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions,
    @Inject(AUTH_REPOSITORY) repository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!repository.getRefreshToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getRefreshToken()`');
    }

    if (!repository.revokeToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `revokeToken()`');
    }

    if (!repository.saveToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `saveToken()`');
    }

    super({
      accessTokenLifetime,
      model: repository as Record<string, any>,
      refreshTokenLifetime,
      alwaysIssueNewRefreshToken: tokenOptions.alwaysIssueNewRefreshToken,
      jwtOptions: tokenOptions.jwt,
    });
  }

  async handle(request: { body: Record<string, unknown> }, client: OAuthClient) {
    if (!request) {
      throw new InvalidArgumentException('Missing parameter: `request`');
    }

    if (!client) {
      throw new InvalidArgumentException('Missing parameter: `client`');
    }

    let token = await this.getRefreshToken(request, client);
    token = await this.revokeToken(token);

    const scope = this.getScopeWithToken(request, token);

    return this.saveToken(token.user, client, scope);
  }

  async getRefreshToken(request: { body: Record<string, unknown> }, client: OAuthClient): Promise<RefreshToken> {
    const refreshTokenValue = request.body.refresh_token as string | undefined;
    if (!refreshTokenValue) {
      throw new InvalidRequestException('Missing parameter: `refresh_token`');
    }

    if (!isFormat.vschar(refreshTokenValue)) {
      throw new InvalidRequestException('Invalid parameter: `refresh_token`');
    }

    const token = await this.model.getRefreshToken(refreshTokenValue);
    if (!token) {
      throw new InvalidGrantException('Invalid grant: refresh token is invalid');
    }

    if (!token.client) {
      throw new ServerException('Server error: `getRefreshToken()` did not return a `client` object');
    }

    if (!token.user) {
      throw new ServerException('Server error: `getRefreshToken()` did not return a `user` object');
    }

    if (token.client.id !== client.id) {
      throw new InvalidGrantException('Invalid grant: refresh token was issued to another client');
    }

    if (token.refreshTokenExpiresAt && !(token.refreshTokenExpiresAt instanceof Date)) {
      throw new ServerException('Server error: `refreshTokenExpiresAt` must be a Date instance');
    }

    if (token.refreshTokenExpiresAt && token.refreshTokenExpiresAt < new Date()) {
      throw new InvalidGrantException('Invalid grant: refresh token has expired');
    }

    return token;
  }

  async revokeToken(token: RefreshToken) {
    if (this.alwaysIssueNewRefreshToken === false) {
      return token;
    }

    const status = await this.model.revokeToken(token);
    if (!status) {
      throw new InvalidGrantException('Invalid grant: refresh token is invalid or could not be revoked');
    }

    return token;
  }

  async saveToken(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<OAuthToken> {
    const accessToken = await this.generateAccessToken(client, user, scope);
    const refreshToken = await this.generateRefreshToken(client, user, scope);
    const accessTokenExpiresAt = this.getAccessTokenExpiresAt();
    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();
    const token: OAuthToken = {
      accessToken,
      accessTokenExpiresAt,
      scope,
      client,
      user,
    } as OAuthToken;

    if (this.alwaysIssueNewRefreshToken !== false) {
      token.refreshToken = refreshToken;
      token.refreshTokenExpiresAt = refreshTokenExpiresAt;
    }

    return this.model.saveToken(token, client, user);
  }

  getScopeWithToken(request: { body: Record<string, unknown> }, token: RefreshToken) {
    const requestedScope = super.getScope(request);
    const originalScope = token.scope;

    if (!originalScope && !requestedScope) {
      return undefined;
    }

    if (!originalScope && requestedScope) {
      throw new InvalidScopeException('Invalid scope: Unable to add extra scopes');
    }

    if (!requestedScope) {
      return originalScope;
    }

    const valid = requestedScope.every((scope) => originalScope?.includes(scope));
    if (!valid) {
      throw new InvalidScopeException('Invalid scope: Unable to add extra scopes');
    }

    return requestedScope;
  }
}
