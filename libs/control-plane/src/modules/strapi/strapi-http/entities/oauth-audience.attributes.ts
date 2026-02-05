/**
 * Attributes envelope for the Strapi oauth-audiences collection.
 * Used as payload for create/update and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthAudienceAttributes {
  /** Audience identifier value (e.g. resource indicator or scope prefix). */
  value: string;
  /** Optional human-readable description. */
  description?: string;
}
