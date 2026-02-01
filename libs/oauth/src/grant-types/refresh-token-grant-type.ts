import { isFormat } from '../utils/formats.util';
import {
  InvalidArgumentException,
  InvalidGrantException,
  InvalidRequestException,
  InvalidScopeException,
  ServerException,
} from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, RefreshToken } from '../interfaces';
import { AbstractGrantType } from './abstract-grant-type';

export class RefreshTokenGrantType extends AbstractGrantType {
  constructor(options: {
    accessTokenLifetime: number;
    model: Record<string, any>;
    refreshTokenLifetime?: number;
    alwaysIssueNewRefreshToken?: boolean;
  }) {
    if (!options.model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }

    if (!options.model.getRefreshToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getRefreshToken()`');
    }

    if (!options.model.revokeToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `revokeToken()`');
    }

    if (!options.model.saveToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `saveToken()`');
    }

    super(options);
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
