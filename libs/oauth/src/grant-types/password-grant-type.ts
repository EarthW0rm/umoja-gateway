import { isFormat } from '../utils/formats.util';
import { InvalidArgumentException, InvalidGrantException, InvalidRequestException } from '../exceptions';
import type { OAuthClient, OAuthToken, OAuthUser } from '../interfaces';
import { AbstractGrantType } from './abstract-grant-type';

export class PasswordGrantType extends AbstractGrantType {
  constructor(options: { accessTokenLifetime: number; model: Record<string, any>; refreshTokenLifetime?: number }) {
    if (!options.model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }

    if (!options.model.getUser) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getUser()`');
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
