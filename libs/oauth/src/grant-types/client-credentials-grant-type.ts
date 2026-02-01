import { Inject, Injectable } from '@nestjs/common';
import { InvalidArgumentException, InvalidGrantException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

@Injectable()
export class ClientCredentialsGrantType extends AbstractGrantType {
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions,
    @Inject(AUTH_REPOSITORY) repository: AuthRepository,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const accessTokenLifetime = tokenOptions.accessTokenLifetime ?? 60 * 60;
    const refreshTokenLifetime = tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14;

    if (!repository.getUserFromClient) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getUserFromClient()`');
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
    const user = await this.getUserFromClient(client);

    return this.saveToken(user, client, scope);
  }

  async getUserFromClient(client: OAuthClient): Promise<OAuthUser> {
    const user = await this.model.getUserFromClient(client);
    if (!user) {
      throw new InvalidGrantException('Invalid grant: user credentials are invalid');
    }
    return user;
  }

  async saveToken(user: OAuthUser, client: OAuthClient, requestedScope?: string[]): Promise<OAuthToken> {
    const validatedScope = await this.validateScope(user, client, requestedScope);
    const accessToken = await this.generateAccessToken(client, user, validatedScope);
    const accessTokenExpiresAt = this.getAccessTokenExpiresAt();
    const token: OAuthToken = {
      accessToken,
      accessTokenExpiresAt,
      scope: validatedScope,
      client,
      user,
    } as OAuthToken;

    return this.model.saveToken(token, client, user);
  }
}
