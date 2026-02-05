/**
 * Attributes envelope for the Strapi oauth-refresh-tokens collection.
 * Used as payload for create and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthRefreshTokenAttributes {
  /** The refresh token string. */
  refreshToken: string;
  /** ISO 8601 date-time when the refresh token expires. */
  refreshTokenExpiresAt: string;
  /** Granted scopes. May be array or space-separated string. */
  scope?: string[] | string | null;
  /** Related oauth-client (relation; may be id, documentId, or populated object). */
  client?: unknown;
  /** Related oauth-user (relation; may be id, documentId, or populated object). */
  user?: unknown;
}
