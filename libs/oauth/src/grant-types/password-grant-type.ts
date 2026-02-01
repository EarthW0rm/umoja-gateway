import { Inject, Injectable } from '@nestjs/common';
import { isFormat } from '../utils/formats.util';
import { InvalidArgumentException, InvalidGrantException, InvalidRequestException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

/**
 * Implements the password grant type for first-party resource owner flows.
 */
@Injectable()
export class PasswordGrantType extends AbstractGrantType {
  /**
   * Creates a password grant handler.
   * @param options Input payload containing token lifetimes.
   * @param repository Input payload repository implementing user lookup and token persistence.
   * @throws {InvalidArgumentException} When repository requirements are not met.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions,
    @Inject(AUTH_REPOSITORY) repository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!repository.getUser) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getUser()`');
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

  /**
   * Issues tokens using the resource owner password credentials grant.
   * @param request Input payload containing username and password.
   * @param client Input payload representing the OAuth client.
   * @returns Persisted token model.
   * @throws {InvalidArgumentException | InvalidGrantException | InvalidRequestException}
   */
  async handle(request: { body: Record<string, unknown> }, client: OAuthClient) {
    if (!request) {
      throw new InvalidArgumentException('Missing parameter: `request`');
    }

    if (!client) {
      throw new InvalidArgumentException('Missing parameter: `client`');
    }

    const scope = this.getScope(request);
    const user = await this.getUser(request, client);

    return this.saveToken(user, client, scope);
  }

  /**
   * Authenticates the resource owner using provided credentials.
   * @param request Input payload containing username and password.
   * @param client Input payload representing the OAuth client.
   * @returns The authenticated user model.
   * @throws {InvalidRequestException | InvalidGrantException}
   */
  async getUser(request: { body: Record<string, unknown> }, client: OAuthClient): Promise<OAuthUser> {
    const username = request.body.username as string | undefined;
    const password = request.body.password as string | undefined;

    if (!username) {
      throw new InvalidRequestException('Missing parameter: `username`');
    }

    if (!password) {
      throw new InvalidRequestException('Missing parameter: `password`');
    }

    if (!isFormat.uchar(username)) {
      throw new InvalidRequestException('Invalid parameter: `username`');
    }

    if (!isFormat.uchar(password)) {
      throw new InvalidRequestException('Invalid parameter: `password`');
    }

    const user = await this.model.getUser(username, password, client);
    if (!user) {
      throw new InvalidGrantException('Invalid grant: user credentials are invalid');
    }
    return user;
  }

  /**
   * Persists access and refresh tokens for the password grant.
   * @param user Input payload representing the resource owner.
   * @param client Input payload representing the OAuth client.
   * @param requestedScope Requested scope array.
   * @returns Saved OAuth token model.
   */
  async saveToken(user: OAuthUser, client: OAuthClient, requestedScope?: string[]): Promise<OAuthToken> {
    const validatedScope = await this.validateScope(user, client, requestedScope);
    const accessToken = await this.generateAccessToken(client, user, validatedScope);
    const refreshToken = await this.generateRefreshToken(client, user, validatedScope);
    const accessTokenExpiresAt = this.getAccessTokenExpiresAt();
    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

    const token: OAuthToken = {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      scope: validatedScope,
      client,
      user,
    } as OAuthToken;

    return this.model.saveToken(token, client, user);
  }
}
