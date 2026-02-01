import * as request from 'supertest';
import { sign } from 'jsonwebtoken';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth JWT access token (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it(
    'issues JWT with issuer, audience and kid',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();
      await ctx.createUser('jwt-user', 'secret', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'jwt-user',
            password: 'secret',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      const token = tokenRes.body.access_token as string;
      expect(token).toBeDefined();

      const [encodedHeader, encodedPayload] = token.split('.');
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64').toString('utf-8')) as {
        kid?: string;
        alg?: string;
      };
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8')) as {
        iss?: string;
        aud?: string | string[];
        cid?: string;
        scope?: string[] | string;
      };

      expect(header.kid).toBe('umoja-access-key');
      expect(payload.iss).toBe('umoja-api');
      const audClaim = Array.isArray(payload.aud)
        ? payload.aud
        : typeof payload.aud === 'string'
          ? payload.aud.split(' ')
          : [];
      expect(audClaim).toContain('umoja-clients');
      expect(payload.cid).toBe(clientId);
      const scope = Array.isArray(payload.scope)
        ? payload.scope
        : typeof payload.scope === 'string'
          ? payload.scope.split(' ')
          : [];
      expect(scope).toContain('read');

      const profile = await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', `Bearer ${token}`)
        .expect(200);

      expect(profile.body.scopes).toContain('read');
    },
    20000,
  );

  it(
    'issues JWT with multiple audiences from repository',
    async () => {
      const { clientId, clientSecret, audiences } = await ctx.createClient({
        audiences: ['tenant-a', 'tenant-b'],
      });
      await ctx.createUser('jwt-multi', 'secret', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'jwt-multi',
            password: 'secret',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      const token = tokenRes.body.access_token as string;
      const [, encodedPayload] = token.split('.');
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8')) as {
        aud?: string | string[];
        cid?: string;
      };

      const payloadAud = Array.isArray(payload.aud)
        ? payload.aud
        : typeof payload.aud === 'string'
          ? payload.aud.split(' ')
          : [];

      expect(payload.cid).toBe(clientId);
      expect(payloadAud).toEqual(expect.arrayContaining(audiences ?? ['tenant-a', 'tenant-b']));

      await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
    },
    20000,
  );

  it(
    'rejects tampered token signature',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();
      await ctx.createUser('jwt-tamper', 'secret', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'jwt-tamper',
            password: 'secret',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      const original = tokenRes.body.access_token as string;
      const tampered =
        original.slice(0, -1) + (original.endsWith('A') ? 'B' : 'A');

      await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', `Bearer ${tampered}`)
        .expect(401);
    },
    20000,
  );

  it(
    'rejects token with wrong audience even if signed with same key',
    async () => {
      const { clientId } = await ctx.createClient();
      await ctx.createUser('jwt-aud', 'secret', ['read']);

      const customPayload = {
        sub: 'jwt-aud',
        cid: clientId,
        scope: ['read'],
        user: { id: 'jwt-aud', username: 'jwt-aud', scope: ['read'] },
        client: { id: clientId, grants: ['password'], redirectUris: [] },
      };

      const forged = sign(customPayload, 'demo-access-token-secret', {
        algorithm: 'HS256',
        issuer: 'umoja-api',
        audience: 'wrong-aud',
        keyid: 'umoja-access-key',
        expiresIn: 300,
      });

      await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', `Bearer ${forged}`)
        .expect(401);
    },
    20000,
  );
});
