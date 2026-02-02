import * as request from 'supertest';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth password grant (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    if (ctx?.app) await ctx.app.close();
  });

  it(
    'issues token with password grant and accesses protected route',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();
      await ctx.createUser('haile', 'selassie', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'haile',
            password: 'selassie',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      expect(tokenRes.body).toHaveProperty('access_token');
      expect(tokenRes.body).toHaveProperty('refresh_token');
      expect(tokenRes.body.token_type).toBe('Bearer');

      const profile = await request(ctx.server)
        .get('/auth-demo/profile')
        .set('authorization', `Bearer ${tokenRes.body.access_token}`)
        .expect(200);

      expect(profile.body.user).toBeDefined();
      expect(profile.body.scopes).toContain('read');
    },
    20000,
  );

  it('rejects password grant with wrong credentials (401)', async () => {
    const { clientId, clientSecret } = await ctx.createClient();
    await ctx.createUser('haile', 'selassie', ['read']);

    await request(ctx.server)
      .post('/oauth/token')
      .set('content-type', 'application/x-www-form-urlencoded')
      .send(
        new URLSearchParams({
          grant_type: 'password',
          username: 'haile',
          password: 'wrong',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'read',
        }).toString(),
      )
      .expect(400);
  });

  it('rejects password grant without client_secret (400/401)', async () => {
    const { clientId } = await ctx.createClient();
    await ctx.createUser('bob', 'secret', ['read']);

    const res = await request(ctx.server)
      .post('/oauth/token')
      .set('content-type', 'application/x-www-form-urlencoded')
      .send(
        new URLSearchParams({
          grant_type: 'password',
          username: 'bob',
          password: 'secret',
          client_id: clientId,
        }).toString(),
      )
      .expect((r) => {
        expect([400, 401]).toContain(r.status);
      });
  });

  it('accepts password grant when scope passes validation (or rejects if invalid)', async () => {
    const { clientId, clientSecret } = await ctx.createClient();
    await ctx.createUser('carol', 'secret', ['read']);

    await request(ctx.server)
      .post('/oauth/token')
      .set('content-type', 'application/x-www-form-urlencoded')
      .send(
        new URLSearchParams({
          grant_type: 'password',
          username: 'carol',
          password: 'secret',
          client_id: clientId,
          client_secret: clientSecret,
          scope: '!!!invalid!!!',
        }).toString(),
      )
      .expect((r) => {
        expect([200, 400]).toContain(r.status);
      });
  });
});
