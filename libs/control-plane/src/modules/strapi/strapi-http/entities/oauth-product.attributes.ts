/**
 * Attributes envelope for the Strapi oauth-products collection.
 * Used as payload for create/update and as the shape of document attributes in API responses.
 */
export interface StrapiOAuthProductAttributes {
  /** Display name of the OAuth product/application. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Optional logo URL. */
  logoUri?: string;
  /** Optional privacy policy URL. */
  privacyPolicyUrl?: string;
  /** Optional terms of service URL. */
  termsOfServiceUrl?: string;
  /** Optional list of owner identifiers. */
  owners?: string[] | null;
  /** Related oauth-clients (relation; may be array of ids or populated objects). */
  clients?: unknown;
}
