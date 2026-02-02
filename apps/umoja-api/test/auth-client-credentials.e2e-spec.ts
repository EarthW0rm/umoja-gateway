import * as request from 'supertest';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth client_credentials grant (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    if (ctx?.app) await ctx.app.close();
  });

  it(
    'issues token with client_credentials grant',
    async () => {
      await ctx.createUser('svc', 'svc', ['read']);
      const { clientId, clientSecret } = await ctx.createClient({
        userId: 'svc',
        grants: ['client_credentials'],
      });

      const tokenRes = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
        )
        .expect(200);

      expect(tokenRes.body).toHaveProperty('access_token');
      expect(tokenRes.body.token_type).toBe('Bearer');
    },
    20000,
  );

  it(
    'rejects client_credentials without client_secret (400)',
    async () => {
      const { clientId } = await ctx.createClient({ grants: ['client_credentials'] });

      await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
          }).toString(),
        )
        .expect((r) => {
          expect([400, 401]).toContain(r.status);
        });
    },
    20000,
  );

  it(
    'rejects client_credentials with invalid secret (401/400)',
    async () => {
      const { clientId } = await ctx.createClient({ grants: ['client_credentials'] });

      const res = await request(ctx.server)
        .post('/oauth/token')
        .set('content-type', 'application/x-www-form-urlencoded')
        .send(
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: 'wrong',
          }).toString(),
        );

      expect([400, 401]).toContain(res.status);
    },
    20000,
  );
});
