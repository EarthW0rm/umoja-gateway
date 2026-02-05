/**
 * Attributes envelope for the Strapi oauth-authorization-codes collection.
 * Used as payload for create and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthAuthorizationCodeAttributes {
  /** The authorization code string issued to the client. */
  authorizationCode: string;
  /** ISO 8601 date-time when the code expires. */
  expiresAt: string;
  /** Redirect URI to which the code was issued. */
  redirectUri: string;
  /** Requested scopes. May be array or space-separated string. */
  scope?: string[] | string | null;
  /** PKCE code challenge (optional, for public clients). */
  codeChallenge?: string | null;
  /** PKCE code challenge method (e.g. S256, plain). */
  codeChallengeMethod?: string | null;
  /** Related oauth-client (relation; may be id, documentId, or populated object). */
  client?: unknown;
  /** Related oauth-user (relation; may be id, documentId, or populated object). */
  user?: unknown;
}
