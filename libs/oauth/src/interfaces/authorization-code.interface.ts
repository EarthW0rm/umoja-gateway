import type { OAuthClient } from './client.interface';
import type { OAuthUser } from './user.interface';

/**
 * Output model representing an issued authorization code.
 */
export interface AuthorizationCode {
  /**
   * The opaque authorization code string.
   */
  authorizationCode: string;
  /**
   * Expiration date for the authorization code.
   */
  expiresAt: Date;
  /**
   * Redirect URI bound to the code.
   */
  redirectUri: string;
  /**
   * Scopes granted to the code.
   */
  scope?: string[];
  /**
   * Client associated with the code.
   */
  client: OAuthClient;
  /**
   * Resource owner who authorized the code.
   */
  user: OAuthUser;
  /**
   * PKCE code challenge when present.
   */
  codeChallenge?: string;
  /**
   * PKCE transformation method (plain or S256).
   */
  codeChallengeMethod?: string;
  /**
   * Additional attributes for extension.
   */
  [key: string]: unknown;
}
