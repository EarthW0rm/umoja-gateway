jest.mock('jsonwebtoken', () => {
  return {
    sign: jest.fn().mockReturnValue('signed-jwt'),
    verify: jest.fn().mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      scope: ['read', 'write'],
      user: { id: 'user' },
      client: { id: 'client' },
    }),
  };
});

import {
  buildAccessTokenPayload,
  mapPayloadToOAuthToken,
  sanitizeClient,
  sanitizeUser,
  signAccessTokenJwt,
  verifyAccessTokenJwt,
} from './jwt.util';

describe('jwt.util', () => {
  const client = { id: 'client' } as any;
  const user = { id: 'user', email: 'user@test.com' } as any;
  const options = { secret: 'test-secret', issuer: 'issuer', audience: 'api' };

  it('builds payload with sub and cid', () => {
    const payload = buildAccessTokenPayload({ client, user, scope: ['read'] });
    expect(payload.sub).toBe('user');
    expect(payload.cid).toBe('client');
  });

  it('sanitizeUser excludes password from payload.user (line 166)', () => {
    const userWithPassword = { id: 'u', username: 'joe', password: 'secret' };
    const payload = buildAccessTokenPayload({ client, user: userWithPassword as any, scope: ['read'] });
    expect(payload.user).toBeDefined();
    expect(payload.user).not.toHaveProperty('password');
    expect(payload.user).toHaveProperty('id', 'u');
    expect(payload.user).toHaveProperty('username', 'joe');
  });

  it('sanitizeUser sets clone.id from username when id is missing (line 171)', () => {
    const userWithUsernameOnly = { username: 'joe', password: 'x' };
    const payload = buildAccessTokenPayload({ client, user: userWithUsernameOnly as any, scope: ['read'] });
    expect(payload.user).toBeDefined();
    expect(payload.user).toHaveProperty('id', 'joe');
    expect(payload.sub).toBe('joe');
  });

  it('sanitizeClient excludes clientSecret from payload.client (line 180)', () => {
    const clientWithSecret = { id: 'c', clientSecret: 'secret' };
    const payload = buildAccessTokenPayload({ client: clientWithSecret as any, user, scope: ['read'] });
    expect(payload.client).toBeDefined();
    expect(payload.client).not.toHaveProperty('clientSecret');
    expect(payload.client).toHaveProperty('id', 'c');
  });

  it('sanitizeClient sets clone.id from client.id when id not in own keys (line 185)', () => {
    const clientWithProtoId = Object.create({ id: 'from-prototype' });
    (clientWithProtoId as any).clientSecret = 'secret';
    const payload = buildAccessTokenPayload({ client: clientWithProtoId as any, user, scope: ['read'] });
    expect(payload.client).toBeDefined();
    expect(payload.client).toHaveProperty('id', 'from-prototype');
    expect(payload.cid).toBe('from-prototype');
  });

  it('sanitizeUser copies all non-password keys to payload.user (line 164)', () => {
    const userOnlySafeKeys = { id: 'u1', email: 'u@test.com', name: 'User One' };
    const payload = buildAccessTokenPayload({ client, user: userOnlySafeKeys as any, scope: ['read'] });
    expect(payload.user).toEqual({ id: 'u1', email: 'u@test.com', name: 'User One' });
  });

  it('sanitizeUser runs clone[key]=value when key is not password (line 164 branch)', () => {
    const userWithSingleKey = { id: 'single' };
    const payload = buildAccessTokenPayload({ client, user: userWithSingleKey as any, scope: [] });
    expect(payload.user).toHaveProperty('id', 'single');
  });

  it('sanitizeClient copies all non-clientSecret keys to payload.client (line 178)', () => {
    const clientOnlySafeKeys = { id: 'c1', name: 'Test Client', redirectUris: ['https://app.test'] };
    const payload = buildAccessTokenPayload({ client: clientOnlySafeKeys as any, user, scope: ['read'] });
    expect(payload.client).toEqual({ id: 'c1', name: 'Test Client', redirectUris: ['https://app.test'] });
  });

  it('sanitizeClient runs clone[key]=value when key is not clientSecret (line 178 branch)', () => {
    const clientWithSingleKey = { id: 'single-client' };
    const payload = buildAccessTokenPayload({ client: clientWithSingleKey as any, user, scope: [] });
    expect(payload.client).toHaveProperty('id', 'single-client');
  });

  it('sanitizeUser with null or empty object returns empty clone (zero iterations branch)', () => {
    expect(sanitizeUser(null as any)).toEqual({});
    expect(sanitizeUser(undefined as any)).toEqual({});
    expect(sanitizeUser({} as any)).toEqual({});
  });

  it('sanitizeClient with null or empty object returns empty clone (zero iterations branch)', () => {
    expect(sanitizeClient(null as any)).toEqual({});
    expect(sanitizeClient(undefined as any)).toEqual({});
    expect(sanitizeClient({} as any)).toEqual({});
  });

  it('signs and verifies a JWT access token', () => {
    const payload = { ...buildAccessTokenPayload({ client, user, scope: ['read'] }), jti: 'kid-1' };
    const token = signAccessTokenJwt(payload, options, 60);
    const verified = verifyAccessTokenJwt(token, options);
    expect(verified.cid).toBe('client');
    expect(verified.scope).toEqual(['read', 'write']);
  });

  it('maps payload to OAuth token', () => {
    const payload = { ...buildAccessTokenPayload({ client, user, scope: ['read', 'write'] }), jti: 'kid-2' };
    const token = signAccessTokenJwt(payload, options, 60);
    const verified = verifyAccessTokenJwt(token, options);
    const mapped = mapPayloadToOAuthToken(token, verified);
    expect(mapped.accessToken).toBe(token);
    expect(mapped.client.id).toBe('client');
    expect(mapped.scope).toEqual(['read', 'write']);
  });

  it('throws when user or client identifiers are missing', () => {
    expect(() => buildAccessTokenPayload({ client: {}, user: {} } as any)).toThrow();
    expect(() => buildAccessTokenPayload({ client: { id: 'c' }, user: {} } as any)).toThrow();
    expect(() => buildAccessTokenPayload({ client: {}, user: { id: 'u' } } as any)).toThrow();
  });

  it('signs with privateKey and RS256 when privateKey is provided', () => {
    const payload = buildAccessTokenPayload({ client, user, scope: ['read'] });
    const jwt = require('jsonwebtoken');
    signAccessTokenJwt(payload, { privateKey: 'rsa-key' } as any, 60);
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.any(Object),
      'rsa-key',
      expect.objectContaining({ algorithm: 'RS256' }),
    );
  });

  it('verifies with audience as string', () => {
    const token = 'token';
    verifyAccessTokenJwt(token, { secret: 's', audience: 'api' } as any);
    expect(require('jsonwebtoken').verify).toHaveBeenCalledWith(
      token,
      's',
      expect.objectContaining({ audience: 'api' }),
    );
  });

  it('verifies with audience as array and algorithm', () => {
    const token = 'token';
    verifyAccessTokenJwt(token, { secret: 's', audience: ['api1', 'api2'], algorithm: 'HS256' } as any);
    const jwt = require('jsonwebtoken');
    expect(jwt.verify).toHaveBeenCalledWith(
      token,
      's',
      expect.objectContaining({ audience: ['api1', 'api2'], algorithms: ['HS256'] }),
    );
  });

  it('verifies with clockToleranceSeconds', () => {
    const token = 'token';
    verifyAccessTokenJwt(token, { secret: 's', clockToleranceSeconds: 5 } as any);
    expect(require('jsonwebtoken').verify).toHaveBeenCalledWith(
      token,
      's',
      expect.objectContaining({ clockTolerance: 5 }),
    );
  });

  it('mapPayloadToOAuthToken handles scope and audience as string', () => {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      scope: 'read write',
      aud: 'api1 api2',
      user: { id: 'user' },
      client: { id: 'client' },
    } as any;
    const mapped = mapPayloadToOAuthToken('t', payload);
    expect(mapped.scope).toEqual(['read', 'write']);
    expect((mapped as any).audience).toEqual(['api1', 'api2']);
  });

  it('mapPayloadToOAuthToken handles scope and audience as array', () => {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      scope: ['read', 'write'],
      aud: ['api1', 'api2'],
      user: { id: 'user' },
      client: { id: 'client' },
    } as any;
    const mapped = mapPayloadToOAuthToken('t', payload);
    expect(mapped.scope).toEqual(['read', 'write']);
    expect((mapped as any).audience).toEqual(['api1', 'api2']);
  });

  it('mapPayloadToOAuthToken uses sub and cid when user and client missing in payload', () => {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user-id',
      cid: 'client-id',
    } as any;
    const mapped = mapPayloadToOAuthToken('t', payload);
    expect(mapped.user.id).toBe('user-id');
    expect(mapped.client.id).toBe('client-id');
  });

  it('throws when signing key is missing', () => {
    const payload = buildAccessTokenPayload({ client, user });
    expect(() => signAccessTokenJwt(payload, {}, 10 as any)).toThrow();
  });

  it('throws when payload lacks exp during mapping', () => {
    const invalidPayload = { sub: 'u', cid: 'c' } as any;
    expect(() => mapPayloadToOAuthToken('t', invalidPayload)).toThrow();
  });

  it('throws when payload lacks sub during mapping', () => {
    const invalidPayload = { exp: Math.floor(Date.now() / 1000) + 60, cid: 'c' } as any;
    expect(() => mapPayloadToOAuthToken('t', invalidPayload)).toThrow();
  });

  it('throws when verification key is missing', () => {
    const token = 'token';
    const options = {};
    jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => {
      throw new Error('key missing');
    });
    expect(() => verifyAccessTokenJwt(token, options as any)).toThrow();
  });
});
