/**
 * Injection token for the API key validator used by ApiKeyGuard.
 */
export const OAUTH_API_KEY_VALIDATOR = Symbol('OAUTH_API_KEY_VALIDATOR');

/**
 * Contract for validating x-api-key header in ApiKeyGuard.
 */
export interface ApiKeyValidator {
  /**
   * Returns true when the given API key is valid.
   * @param apiKey - Value from the request header (e.g. x-api-key).
   * @returns True when the key is accepted.
   */
  validate(apiKey: string | undefined): boolean;
}

/**
 * Injection token for the Basic auth validator used by BasicAuthGuard.
 */
export const OAUTH_BASIC_AUTH_VALIDATOR = Symbol('OAUTH_BASIC_AUTH_VALIDATOR');

/**
 * Result of a successful Basic auth validation.
 */
export interface BasicAuthValidationResult {
  /**
   * Authenticated user to attach to the request.
   */
  user: unknown;
}

/**
 * Contract for validating username/password (e.g. Authorization: Basic) in BasicAuthGuard.
 */
export interface BasicAuthValidator {
  /**
   * Validates credentials and returns the user when valid.
   * @param username - Username from the Basic auth header.
   * @param password - Password from the Basic auth header.
   * @returns The user object when valid, or null when invalid.
   */
  validate(username: string, password: string): Promise<BasicAuthValidationResult | null>;
}
