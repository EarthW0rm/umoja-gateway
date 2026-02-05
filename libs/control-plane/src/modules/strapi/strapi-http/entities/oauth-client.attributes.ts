/**
 * Attributes envelope for the Strapi oauth-clients collection.
 * Used as payload for create/update and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthClientAttributes {
  /** Allowed redirect URIs for the client. May be array or comma-separated string from Strapi. */
  redirectUris: string[] | string;
  /** Client secret used for confidential client authentication. */
  clientSecret: string;
  /** OAuth2 grant types (e.g. client_credentials, password, refresh_token). May be array or string. */
  grants: string[] | string;
  /** Access token lifetime in seconds. */
  accessTokenLifetime: number;
  /** Refresh token lifetime in seconds. */
  refreshTokenLifetime: number;
  /** Related oauth-product (relation; may be id, documentId, or populated object). */
  product?: unknown;
  /** Related oauth-user (relation; may be id, documentId, or populated object). */
  user?: unknown;
  /** Related oauth-audiences (relation; may be array of ids or populated objects). */
  audiences?: unknown;
}
