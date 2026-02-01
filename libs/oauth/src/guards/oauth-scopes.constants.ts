/**
 * Metadata key used by OAuthScopeGuard to read required scopes from handler/controller.
 * Set via the @OAuthScopes(...scopes) decorator. Reflector.getAllAndOverride(OAUTH_SCOPES_KEY, [handler, class]) returns string[].
 */
export const OAUTH_SCOPES_KEY = 'oauth:scopes';
