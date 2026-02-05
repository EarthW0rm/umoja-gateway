/**
 * Attributes envelope for the Strapi oauth-api-keys collection.
 * Used as the shape of document attributes in API responses (e.g. for API key validation cache).
 */
export interface StrapiOAuthApiKeyAttributes {
  /** The API key string used for bearer or header authentication. */
  apiKey: string;
  /** Optional description for the key. */
  description?: string;
  /** Related oauth-client (relation; may be id, documentId, or populated object). */
  client?: unknown;
}
