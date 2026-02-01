import type { OAuthProduct } from './product.interface';

/**
 * Input payload describing an OAuth client application.
 */
export interface OAuthClient {
  /**
   * Unique identifier for the client. Must be a stable string.
   */
  id: string;
  /**
   * Allowed redirect URIs for authorization flows.
   */
  redirectUris?: string | string[];
  /**
   * Client secret for confidential clients. Must be kept secure.
   */
  clientSecret?: string;
  /**
   * Authorized grant types for this client.
   */
  grants: string[] | string;
  /**
   * Optional per-client access token lifetime in seconds.
   */
  accessTokenLifetime?: number;
  /**
   * Optional per-client refresh token lifetime in seconds.
   */
  refreshTokenLifetime?: number;
  /**
   * Identifier of the product that owns this client.
   */
  productId?: string;
  /**
   * Product container metadata for this client.
   */
  product?: OAuthProduct;
  /**
   * Additional client metadata (e.g. scope, userId, audiences).
   */
  [key: string]: unknown;
}
