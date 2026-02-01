import { TokenModel } from './token.model';
import { InvalidArgumentException } from '../exceptions';

describe('TokenModel', () => {
  const baseToken = {
    accessToken: 'access',
    client: { id: 'client' },
    user: { id: 'user' },
  } as any;

  it('throws when required fields are missing', () => {
    expect(() => new TokenModel({ client: {}, user: {} } as any)).toThrow(InvalidArgumentException);
    expect(() => new TokenModel({ ...baseToken, client: undefined } as any)).toThrow(InvalidArgumentException);
    expect(() => new TokenModel({ ...baseToken, user: undefined } as any)).toThrow(InvalidArgumentException);
  });

  it('computes access token lifetime when expiresAt is provided', () => {
    const future = new Date(Date.now() + 10_000);
    const model = new TokenModel({ ...baseToken, accessTokenExpiresAt: future });
    expect(model.accessTokenLifetime).toBeGreaterThan(0);
  });

  it('throws when accessTokenExpiresAt is not a Date', () => {
    expect(() =>
      new TokenModel({ ...baseToken, accessTokenExpiresAt: 'not-a-date' as any }),
    ).toThrow(InvalidArgumentException);
  });

  it('throws when refreshTokenExpiresAt is not a Date', () => {
    expect(() =>
      new TokenModel({ ...baseToken, refreshTokenExpiresAt: 123 as any }),
    ).toThrow(InvalidArgumentException);
  });

  it('stores custom attributes when allowed', () => {
    const model = new TokenModel(
      { ...baseToken, foo: 'bar' },
      { allowExtendedTokenAttributes: true },
    );
    expect(model.customAttributes).toEqual({ foo: 'bar' });
  });
});
