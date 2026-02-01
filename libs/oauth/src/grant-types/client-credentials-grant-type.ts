import { Inject, Injectable } from '@nestjs/common';
import { InvalidArgumentException, InvalidGrantException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser, ServerOptions } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import { resolveTokenOptions } from '../utils';

/**
 * Implements the client_credentials grant type for machine-to-machine flows.
 */
@Injectable()
export class ClientCredentialsGrantType extends AbstractGrantType {
  /**
   * Creates a client credentials grant handler.
   * @param options Input payload containing token lifetimes.
   * @param repository Input payload repository implementing client credential hooks.
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

  /**
   * Issues an access token using the client credentials grant.
   * @param request Input payload containing optional scope.
   * @param client Input payload representing the OAuth client.
   * @returns Persisted token model.
   * @throws {InvalidArgumentException | InvalidGrantException}
   */
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

  /**
   * Retrieves the user associated with the client credentials.
   * @param client Input payload representing the OAuth client.
   * @returns The resolved user model.
   * @throws {InvalidGrantException}
   */
  async getUserFromClient(client: OAuthClient): Promise<OAuthUser> {
    const user = await this.model.getUserFromClient(client);
    if (!user) {
      throw new InvalidGrantException('Invalid grant: user credentials are invalid');
    }
    return user;
  }

  /**
   * Persists an access token for the client credentials flow.
   * @param user Input payload representing the resolved user.
   * @param client Input payload representing the OAuth client.
   * @param requestedScope Requested scope array.
   * @returns Saved OAuth token model.
   */
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
