import { BearerTokenType } from './bearer-token-type';
import { InvalidArgumentException } from '../exceptions';

describe('BearerTokenType', () => {
  it('throws when access token is missing', () => {
    expect(() => new BearerTokenType('')).toThrow(InvalidArgumentException);
  });

  it('serializes token response', () => {
    const type = new BearerTokenType('access', 3600, 'refresh', ['read'], { foo: 'bar' });
    const value = type.valueOf();
    expect(value.access_token).toBe('access');
    expect(value.expires_in).toBe(3600);
    expect(value.refresh_token).toBe('refresh');
    expect(value.scope).toEqual(['read']);
    expect(value.foo).toBe('bar');
  });
});
