import type { OAuthClient } from './client.interface';
import type { OAuthUser } from './user.interface';

/**
 * Output model representing an issued OAuth token set.
 */
export interface OAuthToken {
  /**
   * Access token string issued to the client.
   */
  accessToken: string;
  /**
   * Expiration date for the access token. Must be a valid Date instance.
   */
  accessTokenExpiresAt?: Date;
  /**
   * Refresh token string when provided.
   */
  refreshToken?: string;
  /**
   * Expiration date for the refresh token. Must be a valid Date instance.
   */
  refreshTokenExpiresAt?: Date;
  /**
   * Authorized scopes for the token.
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
   * Additional token attributes for extension.
   */
  [key: string]: unknown;
}
