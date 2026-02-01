import { Inject, Injectable } from '@nestjs/common';
import { isFormat } from '../utils/formats.util';
import { InvalidArgumentException, InvalidGrantException, InvalidRequestException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

@Injectable()
export class PasswordGrantType extends AbstractGrantType {
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
