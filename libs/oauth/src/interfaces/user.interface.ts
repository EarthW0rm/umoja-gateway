/**
 * Input payload representing a resource owner in OAuth flows.
 */
export interface OAuthUser {
  /**
   * Arbitrary user attributes required by repository implementations.
   */
  [key: string]: unknown;
}
