import * as request from 'supertest';
import { bootstrapE2E } from './utils/e2e-setup';

describe('OAuth unauthorized cases (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2E>>;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  });

  afterAll(async () => {
    if (ctx?.app) await ctx.app.close();
  });

  it('returns 401 when accessing protected route without bearer token', async () => {
    await request(ctx.server).get('/auth-demo/profile').expect(401);
  });
});
