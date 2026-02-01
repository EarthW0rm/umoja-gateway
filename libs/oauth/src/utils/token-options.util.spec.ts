import { resolveTokenOptions } from './token-options.util';

describe('token-options.util', () => {
  it('merges nested token options', () => {
    const options = resolveTokenOptions({
      accessTokenLifetime: 100,
      token: { refreshTokenLifetime: 200, allowExtendedTokenAttributes: true },
    });
    expect(options.accessTokenLifetime).toBe(100);
    expect(options.refreshTokenLifetime).toBe(200);
    expect(options.allowExtendedTokenAttributes).toBe(true);
  });

  it('prefers top-level overrides', () => {
    const options = resolveTokenOptions({
      token: { accessTokenLifetime: 50, requireClientAuthentication: { password: false } },
      accessTokenLifetime: 30,
    });
    expect(options.accessTokenLifetime).toBe(30);
    expect(options.requireClientAuthentication).toEqual({ password: false });
  });
});
