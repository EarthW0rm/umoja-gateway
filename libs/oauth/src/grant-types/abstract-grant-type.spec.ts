import { AbstractGrantType } from './abstract-grant-type';
import { InvalidArgumentException, InvalidScopeException } from '../exceptions';
import { signAccessTokenJwt } from '../utils';

class TestGrant extends AbstractGrantType {
  constructor(opts: any) {
    super(opts);
  }
}

describe('AbstractGrantType', () => {
  const client = { id: 'client' } as any;
  const user = { id: 'user' } as any;

  it('throws when required constructor options are missing', () => {
    expect(() => new TestGrant({ authRepository: {} })).toThrow(InvalidArgumentException);
    expect(() => new TestGrant({ accessTokenLifetime: 10 })).toThrow(InvalidArgumentException);
  });

  it('generates access token via jwt options', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: {},
      jwtOptions: { privateKey: 'key' },
    });
    const spy = jest.spyOn(require('../utils'), 'signAccessTokenJwt').mockReturnValue('jwt-token');
    const token = await grant.generateAccessToken(client, user, ['read']);
    expect(token).toBe('jwt-token');
    spy.mockRestore();
  });

  it('generates access token with jwt audience from options', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: {},
      jwtOptions: { privateKey: 'key', audience: 'api.example.com' },
    });
    const signSpy = jest.spyOn(require('../utils'), 'signAccessTokenJwt').mockReturnValue('jwt-token');
    await grant.generateAccessToken(client, user, ['read']);
    expect(signSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ audience: ['api.example.com'] }),
      60,
    );
    signSpy.mockRestore();
  });

  it('generates access token with jwt audience from model getAudiences', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { getAudiences: jest.fn().mockResolvedValue(['audience.from.model']) },
      jwtOptions: { privateKey: 'key' },
    });
    const signSpy = jest.spyOn(require('../utils'), 'signAccessTokenJwt').mockReturnValue('jwt-token');
    await grant.generateAccessToken(client, user, ['read']);
    expect(signSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ audience: ['audience.from.model'] }),
      60,
    );
    signSpy.mockRestore();
  });

  it('generates access token via model hook', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { generateAccessToken: jest.fn().mockResolvedValue('hook-token') },
    });
    const token = await grant.generateAccessToken(client, user, ['read']);
    expect(token).toBe('hook-token');
  });

  it('generates access and refresh tokens via random fallback', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: {},
    });
    const access = await grant.generateAccessToken(client, user);
    const refresh = await grant.generateRefreshToken(client, user);
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
  });

  it('generates refresh token via model hook when present', async () => {
    const customRefresh = jest.fn().mockResolvedValue('custom-refresh');
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { generateRefreshToken: customRefresh },
    });
    const refresh = await grant.generateRefreshToken(client, user, ['read']);
    expect(refresh).toBe('custom-refresh');
    expect(customRefresh).toHaveBeenCalledWith(client, user, ['read']);
  });

  it('throws when model validateScope returns null', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { validateScope: jest.fn().mockResolvedValue(null) },
    });
    await expect(grant.validateScope(user, client, ['read'])).rejects.toBeInstanceOf(InvalidScopeException);
  });

  it('calculates expiration dates', () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      refreshTokenLifetime: 120,
      authRepository: {},
    });
    expect(grant.getAccessTokenExpiresAt()).toBeInstanceOf(Date);
    expect(grant.getRefreshTokenExpiresAt()).toBeInstanceOf(Date);
  });

  it('validates scope using model', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { validateScope: jest.fn().mockResolvedValue(['read']) },
    });
    const scope = await grant.validateScope(user, client, ['read']);
    expect(scope).toEqual(['read']);
  });

  it('throws when model validateScope returns false', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: { validateScope: jest.fn().mockResolvedValue(false) },
    });
    await expect(grant.validateScope(user, client, ['read'])).rejects.toBeInstanceOf(InvalidScopeException);
  });

  it('returns scope when model has no validateScope', async () => {
    const grant = new TestGrant({
      accessTokenLifetime: 60,
      authRepository: {},
    });
    const scope = await grant.validateScope(user, client, ['read']);
    expect(scope).toEqual(['read']);
  });
});
