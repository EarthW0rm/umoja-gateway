import * as request from 'supertest';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth refresh_token grant (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it(
    'issues and uses a refresh token',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();
      await ctx.createUser('bob', 'secret', ['read']);

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'password',
            username: 'bob',
            password: 'secret',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'read',
          }).toString(),
        )
        .expect(200);

      const refresh = tokenRes.body.refresh_token as string;
      expect(refresh).toBeDefined();

      const refreshed = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refresh,
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        )
        .expect(200);

      expect(refreshed.body).toHaveProperty('access_token');
      expect(refreshed.body.access_token).not.toEqual(tokenRes.body.access_token);
    },
    20000,
  );

  it(
    'rejects missing refresh_token with 400',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();

      await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        )
        .expect(400);
    },
    20000,
  );

  it(
    'rejects invalid refresh_token with 400/401',
    async () => {
      const { clientId, clientSecret } = await ctx.createClient();

      const res = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: 'invalid-refresh-token',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        );

      expect([400, 401]).toContain(res.status);
    },
    20000,
  );
});
