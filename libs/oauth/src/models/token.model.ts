import { InvalidArgumentException } from '../exceptions';
import { getLifetimeFromExpiresAt } from '../utils/date.util';
import type { OAuthClient, OAuthToken, OAuthUser } from '../interfaces';

const modelAttributes = new Set([
  'accessToken',
  'accessTokenExpiresAt',
  'refreshToken',
  'refreshTokenExpiresAt',
  'scope',
  'client',
  'user',
]);

/**
 * Output model that normalizes token payloads for responses.
 */
export class TokenModel {
  /**
   * Issued access token string.
   */
  accessToken: string;
  /**
   * Expiration date of the access token.
   */
  accessTokenExpiresAt?: Date;
  /**
   * Lifetime of the access token in seconds.
   */
  accessTokenLifetime?: number;
  /**
   * Issued refresh token string when applicable.
   */
  refreshToken?: string;
  /**
   * Expiration date of the refresh token.
   */
  refreshTokenExpiresAt?: Date;
  /**
   * Authorized scopes linked to the token.
   */
  scope?: string[];
  /**
   * Client associated with the token.
   */
  client: OAuthClient;
  /**
   * Resource owner associated with the token.
   */
  user: OAuthUser;
  /**
   * Additional attributes copied from the input payload.
   */
  customAttributes?: Record<string, unknown>;

  /**
   * Creates a token model from a raw token payload.
   * @param data Input payload representing the token attributes.
   * @param options Input payload controlling extended attributes.
   * @throws {InvalidArgumentException} When required fields are missing or invalid.
   */
  constructor(
    data: OAuthToken & Record<string, unknown>,
    options: { allowExtendedTokenAttributes?: boolean } = {},
  ) {
    const {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      scope,
      client,
      user,
    } = data;

    if (!accessToken) {
      throw new InvalidArgumentException('Missing parameter: `accessToken`');
    }

    if (!client) {
      throw new InvalidArgumentException('Missing parameter: `client`');
    }

    if (!user) {
      throw new InvalidArgumentException('Missing parameter: `user`');
    }

    if (accessTokenExpiresAt && !(accessTokenExpiresAt instanceof Date)) {
      throw new InvalidArgumentException('Invalid parameter: `accessTokenExpiresAt`');
    }

    if (refreshTokenExpiresAt && !(refreshTokenExpiresAt instanceof Date)) {
      throw new InvalidArgumentException('Invalid parameter: `refreshTokenExpiresAt`');
    }

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = accessTokenExpiresAt;
    this.client = client;
    this.refreshToken = refreshToken;
    this.refreshTokenExpiresAt = refreshTokenExpiresAt;
    this.scope = scope;
    this.user = user;

    if (accessTokenExpiresAt) {
      this.accessTokenLifetime = getLifetimeFromExpiresAt(accessTokenExpiresAt);
    }

    if (options.allowExtendedTokenAttributes) {
      this.customAttributes = {};
      Object.keys(data).forEach((key) => {
        if (!modelAttributes.has(key)) {
          this.customAttributes![key] = data[key];
        }
      });
    }
  }
}
