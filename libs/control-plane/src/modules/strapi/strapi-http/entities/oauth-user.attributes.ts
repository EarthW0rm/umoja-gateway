/**
 * Attributes envelope for the Strapi oauth-users collection.
 * Used as payload for create/update and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthUserAttributes {
  /** Unique username for authentication. */
  username: string;
  /** User password (plain or hashed depending on Strapi config; sent in create/update payloads). */
  password: string;
  /** Related oauth-audiences (relation; may be array of ids or populated objects). */
  audiences?: unknown;
}
