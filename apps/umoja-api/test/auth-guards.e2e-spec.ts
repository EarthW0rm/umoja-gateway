import * as request from 'supertest';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth guards (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('OAuthGuard (GET /auth-demo/profile)', () => {
    it('returns 401 when no bearer token is sent', async () => {
      await request(ctx.server).get('/auth-demo/profile').expect(401);
    });

    it('returns 401 with UNAUTHORIZED_REQUEST when Authorization header is missing', async () => {
      const res = await request(ctx.server).get('/auth-demo/profile').expect(401);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED_REQUEST',
        message: expect.any(String),
      });
      expect(res.body.message).toBeTruthy();
    });

    it('returns 400 with INVALID_REQUEST when Authorization is malformed (no Bearer prefix)', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', 'InvalidScheme token123')
        .expect(400);
      expect(res.body).toMatchObject({
        code: 'INVALID_REQUEST',
        message: expect.any(String),
      });
    });

    it('returns 400 when Bearer token is empty', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', 'Bearer ')
        .expect(400);
      expect(res.body.code).toBeDefined();
      expect(res.body.message).toBeTruthy();
    });

    it('returns 401 when Bearer token is invalid or expired', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', 'Bearer invalid-jwt-or-opaque-token')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBeDefined();
      expect(res.body.message).toBeTruthy();
    });

    it(
      'returns 200 with user and scopes when valid token is sent',
      async () => {
        const { clientId, clientSecret } = await ctx.createClient();
        await ctx.createUser('guard-user', 'secret', ['read']);

        const tokenRes = await request(ctx.server)
          .post('/oauth/token')
          .set('content-type', 'application/x-www-form-urlencoded')
          .send(
            new URLSearchParams({
              grant_type: 'password',
              username: 'guard-user',
              password: 'secret',
              client_id: clientId,
              client_secret: clientSecret,
              scope: 'read',
            }).toString(),
          )
          .expect(200);

        const accessToken = tokenRes.body.access_token as string;
        const profile = await request(ctx.server)
          .get('/auth-demo/profile')
          .set('authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(profile.body.user).toBeDefined();
        expect(profile.body.user).toHaveProperty('id');
        expect(profile.body.scopes).toEqual(expect.arrayContaining(['read']));
      },
      20000,
    );
  });

  describe('OAuthScopeGuard + @OAuthScopes (GET /auth-demo/profile/write)', () => {
    it(
      'returns 403 when token has only "read" scope (write required)',
      async () => {
        const { clientId, clientSecret } = await ctx.createClient();
        await ctx.createUser('scope-read-only', 'secret', ['read']);

        const tokenRes = await request(ctx.server)
          .post('/oauth/token')
          .set('content-type', 'application/x-www-form-urlencoded')
          .send(
            new URLSearchParams({
              grant_type: 'password',
              username: 'scope-read-only',
              password: 'secret',
              client_id: clientId,
              client_secret: clientSecret,
              scope: 'read',
            }).toString(),
          )
          .expect(200);

        const accessToken = tokenRes.body.access_token as string;
        const res = await request(ctx.server)
          .get('/auth-demo/profile/write')
          .set('authorization', `Bearer ${accessToken}`)
          .expect(403);

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          code: 'INSUFFICIENT_SCOPE',
          message: expect.stringContaining('write'),
        });
        expect(res.body.message).toContain('read');
      },
      20000,
    );

    it('returns 403 with INSUFFICIENT_SCOPE and required/authorized scopes in message', async () => {
      const { clientId, clientSecret } = await ctx.createClient();
      await ctx.createUser('scope-err-user', 'secret', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'scope-err-user',
            password: 'secret',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      const res = await request(ctx.server)
        .get('/auth-demo/profile/write')
        .set('authorization', `Bearer ${tokenRes.body.access_token}`)
        .expect(403);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INSUFFICIENT_SCOPE');
      expect(res.body.message).toMatch(/required.*write/i);
      expect(res.body.message).toMatch(/authorized/i);
    });

    it(
      'returns 200 with write scope granted when token has "write" scope',
      async () => {
        const { clientId, clientSecret } = await ctx.createClient();
        await ctx.createUser('scope-write-user', 'secret', ['read', 'write']);

        const tokenRes = await request(ctx.server)
          .post('/oauth/token')
          .set('content-type', 'application/x-www-form-urlencoded')
          .send(
            new URLSearchParams({
              grant_type: 'password',
              username: 'scope-write-user',
              password: 'secret',
              client_id: clientId,
              client_secret: clientSecret,
              scope: 'read write',
            }).toString(),
          )
          .expect(200);

        const accessToken = tokenRes.body.access_token as string;
        const res = await request(ctx.server)
          .get('/auth-demo/profile/write')
          .set('authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(res.body.user).toBeDefined();
        expect(res.body.scopes).toEqual(expect.arrayContaining(['read', 'write']));
        expect(res.body.message).toBe('write scope granted');
      },
      20000,
    );

    it('returns 401 when no bearer token is sent (OAuthGuard runs first)', async () => {
      await request(ctx.server).get('/auth-demo/profile/write').expect(401);
    });
  });

  describe('OAuthOptionalGuard (GET /auth-demo/me)', () => {
    it('returns 200 with authenticated false and null user when no token is sent', async () => {
      const res = await request(ctx.server).get('/auth-demo/me').expect(200);

      expect(res.body.authenticated).toBe(false);
      expect(res.body.user).toBeNull();
      expect(res.body.scopes).toBeNull();
    });

    it(
      'returns 200 with authenticated true and user/scopes when valid token is sent',
      async () => {
        const { clientId, clientSecret } = await ctx.createClient();
        await ctx.createUser('optional-user', 'secret', ['read']);

        const tokenRes = await request(ctx.server)
          .post('/oauth/token')
          .set('content-type', 'application/x-www-form-urlencoded')
          .send(
            new URLSearchParams({
              grant_type: 'password',
              username: 'optional-user',
              password: 'secret',
              client_id: clientId,
              client_secret: clientSecret,
              scope: 'read',
            }).toString(),
          )
          .expect(200);

        const accessToken = tokenRes.body.access_token as string;
        const res = await request(ctx.server)
          .get('/auth-demo/me')
          .set('authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(res.body.authenticated).toBe(true);
        expect(res.body.user).toBeDefined();
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.scopes).toEqual(expect.arrayContaining(['read']));
      },
      20000,
    );
  });

  describe('ApiKeyGuard (GET /auth-demo/admin)', () => {
    it('returns 401 when x-api-key header is missing', async () => {
      await request(ctx.server).get('/auth-demo/admin').expect(401);
    });

    it('returns 401 with UNAUTHORIZED_REQUEST and message when x-api-key is missing', async () => {
      const res = await request(ctx.server).get('/auth-demo/admin').expect(401);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED_REQUEST',
        message: expect.any(String),
      });
      expect(res.body.message.toLowerCase()).toMatch(/api key|invalid|missing/);
    });

    it('returns 401 when x-api-key header is invalid', async () => {
      await request(ctx.server)
        .get('/auth-demo/admin')
        .set('x-api-key', 'wrong-key')
        .expect(401);
    });

    it('returns 401 with UNAUTHORIZED_REQUEST when x-api-key is wrong', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/admin')
        .set('x-api-key', 'wrong-key')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED_REQUEST',
        message: expect.any(String),
      });
    });

    it('returns 401 when x-api-key is empty string', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/admin')
        .set('x-api-key', '')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_REQUEST');
    });

    it('returns 200 with message when x-api-key is valid', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/admin')
        .set('x-api-key', ctx.apiKey)
        .expect(200);

      expect(res.body.message).toBe('API key valid');
      expect(res.body.role).toBe('admin');
    });
  });

  describe('BasicAuthGuard (GET /auth-demo/session)', () => {
    it('returns 401 when Authorization header is missing', async () => {
      await request(ctx.server).get('/auth-demo/session').expect(401);
    });

    it('returns 401 with UNAUTHORIZED_REQUEST and message when Authorization is missing', async () => {
      const res = await request(ctx.server).get('/auth-demo/session').expect(401);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED_REQUEST',
        message: expect.any(String),
      });
      expect(res.body.message.toLowerCase()).toMatch(/authorization|missing/);
    });

    it('returns 401 when Authorization is not Basic scheme', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', 'Bearer some-token')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_REQUEST');
      expect(res.body.message.toLowerCase()).toMatch(/basic/);
    });

    it('returns 401 when Basic auth value is missing', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', 'Basic')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_REQUEST');
    });

    it('returns 401 when Basic auth payload is not valid base64', async () => {
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', 'Basic !!!invalid-base64!!!')
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_REQUEST');
    });

    it('returns 401 when Basic auth format has no colon (user:password)', async () => {
      const malformed = Buffer.from('nocolon').toString('base64');
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', `Basic ${malformed}`)
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED_REQUEST');
    });

    it('returns 401 when username or password is invalid', async () => {
      const credentials = Buffer.from('demo:wrong-password').toString('base64');
      await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', `Basic ${credentials}`)
        .expect(401);
    });

    it('returns 401 with UNAUTHORIZED_REQUEST when credentials are invalid', async () => {
      const credentials = Buffer.from('unknown:user').toString('base64');
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', `Basic ${credentials}`)
        .expect(401);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED_REQUEST',
        message: expect.any(String),
      });
      expect(res.body.message.toLowerCase()).toMatch(/invalid|username|password/);
    });

    it('returns 200 with user when credentials are valid (demo user from seed)', async () => {
      const credentials = Buffer.from('demo:demo').toString('base64');
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', `Basic ${credentials}`)
        .expect(200);

      expect(res.body.message).toBe('Basic auth valid');
      expect(res.body.user).toBeDefined();
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('username', 'demo');
    });

    it('returns 200 with user when credentials are from a created user', async () => {
      await ctx.createUser('basic-user', 'basic-secret', ['read']);
      const credentials = Buffer.from('basic-user:basic-secret').toString('base64');
      const res = await request(ctx.server)
        .get('/auth-demo/session')
        .set('authorization', `Basic ${credentials}`)
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('basic-user');
    });
  });
});
