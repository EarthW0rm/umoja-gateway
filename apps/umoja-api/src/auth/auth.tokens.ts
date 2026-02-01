/**
 * Injection token for the expected API key used by the auth repository.
 * Provide this in the auth module (e.g. from ConfigService) so the repository
 * can validate x-api-key headers without reading process.env.
 */
export const AUTH_EXPECTED_API_KEY = Symbol('AUTH_EXPECTED_API_KEY');
