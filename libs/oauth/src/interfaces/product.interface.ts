import type { OAuthClient } from './client.interface';

/**
 * Input payload describing an OAuth product or application container.
 */
export interface OAuthProduct {
  /**
   * Unique identifier for the product. Must be a stable string.
   */
  id: string;
  /**
   * Human-friendly product or brand name.
   */
  name: string;
  /**
   * Optional public description of the product.
   */
  description?: string;
  /**
   * URL for the product logo asset.
   */
  logoUri?: string;
  /**
   * URL pointing to the privacy policy for the product.
   */
  privacyPolicyUrl?: string;
  /**
   * URL pointing to terms of service for the product.
   */
  termsOfServiceUrl?: string;
  /**
   * Contact identifiers (emails or IDs) for product owners.
   */
  owners?: string[];
  /**
   * Optional list of clients belonging to this product.
   */
  clients?: OAuthClient[];
  /**
   * Additional product metadata.
   */
  [key: string]: unknown;
}
