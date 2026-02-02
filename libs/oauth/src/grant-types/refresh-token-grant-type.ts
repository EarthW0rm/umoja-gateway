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

/**
 * Implements the refresh_token grant type for renewing access tokens.
 */
@Injectable()
export class RefreshTokenGrantType extends AbstractGrantType {
  /**
   * Creates a refresh token grant handler.
   * @param options Input payload containing token lifetimes.
   * @param authRepository Input payload repository implementing refresh token operations.
   * @throws {InvalidArgumentException} When repository requirements are not met.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions,
    @Inject(AUTH_REPOSITORY) authRepository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!authRepository.getRefreshToken) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `getRefreshToken()`');
    }

    if (!authRepository.revokeToken) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `revokeToken()`');
    }

    if (!authRepository.saveToken) {
      throw new InvalidArgumentException('Invalid argument: authRepository does not implement `saveToken()`');
    }

    super({
      accessTokenLifetime,
      authRepository: authRepository as Record<string, any>,
      refreshTokenLifetime,
      alwaysIssueNewRefreshToken: tokenOptions.alwaysIssueNewRefreshToken,
      jwtOptions: tokenOptions.jwt,
    });
  }

  /**
   * Renews tokens using a valid refresh token.
   * @param request Input payload containing refresh_token and optional scope.
   * @param client Input payload representing the OAuth client.
   * @returns Persisted token model.
   * @throws {InvalidArgumentException | InvalidRequestException | InvalidGrantException | InvalidScopeException}
   */
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

  /**
   * Retrieves and validates the refresh token from storage.
   * @param request Input payload containing refresh_token.
   * @param client Input payload representing the OAuth client.
   * @returns The validated refresh token model.
   * @throws {InvalidRequestException | InvalidGrantException | ServerException}
   */
  async getRefreshToken(request: { body: Record<string, unknown> }, client: OAuthClient): Promise<RefreshToken> {
    const refreshTokenValue = request.body.refresh_token as string | undefined;
    if (!refreshTokenValue) {
      throw new InvalidRequestException('Missing parameter: `refresh_token`');
    }

    if (!isFormat.vschar(refreshTokenValue)) {
      throw new InvalidRequestException('Invalid parameter: `refresh_token`');
    }

    const token = await this.authRepository.getRefreshToken(refreshTokenValue);
    if (!token) {
      throw new InvalidGrantException(
        'Invalid grant: refresh token is invalid or not found. Use a refresh_token from password or authorization_code grant (client_credentials does not issue refresh tokens).',
      );
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

  /**
   * Revokes the provided refresh token when renewal requires replacement.
   * @param token Input payload representing the refresh token model.
   * @returns The revoked token model.
   * @throws {InvalidGrantException}
   */
  async revokeToken(token: RefreshToken) {
    if (this.alwaysIssueNewRefreshToken === false) {
      return token;
    }

    const status = await this.authRepository.revokeToken(token);
    if (!status) {
      throw new InvalidGrantException('Invalid grant: refresh token is invalid or could not be revoked');
    }

    return token;
  }

  /**
   * Persists new access and refresh tokens derived from the existing refresh token.
   * @param user Input payload representing the resource owner.
   * @param client Input payload representing the OAuth client.
   * @param scope Scope to attach to the renewed token.
   * @returns Saved OAuth token model.
   */
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

    return this.authRepository.saveToken(token, client, user);
  }

  /**
   * Validates requested scope against the original token scope.
   * @param request Input payload containing scope.
   * @param token Input payload representing the refresh token model.
   * @returns The scope to use for renewed tokens.
   * @throws {InvalidScopeException}
   */
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
