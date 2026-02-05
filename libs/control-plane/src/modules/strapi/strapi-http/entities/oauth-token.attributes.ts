/**
 * Attributes envelope for the Strapi oauth-tokens collection.
 * Used as payload for create and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthTokenAttributes {
  /** The access token string. */
  accessToken: string;
  /** ISO 8601 date-time when the access token expires. */
  accessTokenExpiresAt: string;
  /** Optional refresh token string when refresh_token grant is used. */
  refreshToken?: string | null;
  /** ISO 8601 date-time when the refresh token expires. */
  refreshTokenExpiresAt?: string | null;
  /** Granted scopes. May be array or space-separated string. */
  scope?: string[] | string | null;
  /** Related oauth-client (relation; may be id, documentId, or populated object). */
  client?: unknown;
  /** Related oauth-user (relation; may be id, documentId, or populated object). */
  user?: unknown;
}
