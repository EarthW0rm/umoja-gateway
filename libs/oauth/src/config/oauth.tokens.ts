/**
 * Injection token for OAuth server configuration options.
 * Use with @Inject(OAUTH2_SERVER_OPTIONS) to receive ServerOptions in handlers or services.
 */
export const OAUTH2_SERVER_OPTIONS = Symbol('OAUTH2_SERVER_OPTIONS');

/**
 * Injection token for the OAuth auth repository implementation.
 * Register your AuthRepository implementation with this token so OauthModule can inject it.
 */
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
