import { OAUTH_SCOPES_KEY } from './oauth-scopes.constants';

describe('OAUTH_SCOPES_KEY', () => {
  it('is the metadata key used by OAuthScopeGuard and @OAuthScopes', () => {
    expect(OAUTH_SCOPES_KEY).toBe('oauth:scopes');
  });
});
