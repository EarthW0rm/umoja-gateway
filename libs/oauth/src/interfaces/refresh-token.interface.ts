import type { OAuthClient } from './client.interface';
import type { OAuthUser } from './user.interface';

/**
 * Output model representing a refresh token record.
 */
export interface RefreshToken {
  /**
   * Refresh token string issued to the client.
   */
  refreshToken: string;
  /**
   * Expiration date for the refresh token.
   */
  refreshTokenExpiresAt?: Date;
  /**
   * Scopes granted to the refresh token.
   */
  scope?: string[];
  /**
   * Client associated with the refresh token.
   */
  client: OAuthClient;
  /**
   * Resource owner associated with the refresh token.
   */
  user: OAuthUser;
  /**
   * Additional attributes for extension.
   */
  [key: string]: unknown;
}
