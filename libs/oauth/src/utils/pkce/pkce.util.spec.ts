import { codeChallengeMatchesABNF, getHashForCodeChallenge, isPKCERequest, isValidMethod } from './pkce.util';

describe('pkce.util', () => {
  it('returns plain verifier when method is plain', () => {
    expect(getHashForCodeChallenge({ method: 'plain', verifier: 'abc' })).toBe('abc');
  });

  it('computes S256 hash when method is S256', () => {
    const challenge = getHashForCodeChallenge({ method: 'S256', verifier: 'verifier-123' });
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).toHaveLength(43);
  });

  it('returns undefined for invalid method or missing verifier', () => {
    expect(getHashForCodeChallenge({ method: 'foo', verifier: 'abc' })).toBeUndefined();
    expect(getHashForCodeChallenge({ method: 'plain' })).toBeUndefined();
  });

  it('validates ABNF for code challenge', () => {
    expect(codeChallengeMatchesABNF('a'.repeat(43))).toBe(true);
    expect(codeChallengeMatchesABNF('invalid space')).toBe(false);
  });

  it('detects PKCE request only for authorization_code with verifier', () => {
    expect(isPKCERequest({ grantType: 'authorization_code', codeVerifier: 'v' })).toBe(true);
    expect(isPKCERequest({ grantType: 'password', codeVerifier: 'v' })).toBe(false);
    expect(isPKCERequest({ grantType: 'authorization_code' })).toBe(false);
  });

  it('validates supported methods', () => {
    expect(isValidMethod('S256')).toBe(true);
    expect(isValidMethod('plain')).toBe(true);
    expect(isValidMethod('md5')).toBe(false);
  });
});
