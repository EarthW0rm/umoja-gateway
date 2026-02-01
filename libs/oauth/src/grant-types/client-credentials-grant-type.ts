import { InvalidArgumentException, InvalidGrantException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser } from '../interfaces';
import { AbstractGrantType } from './abstract-grant-type';

export class ClientCredentialsGrantType extends AbstractGrantType {
  constructor(options: { accessTokenLifetime: number; model: Record<string, any> }) {
    if (!options.model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }

    if (!options.model.getUserFromClient) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getUserFromClient()`');
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
