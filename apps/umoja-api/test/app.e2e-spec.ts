import { bootstrapE2E } from './utils/e2e-setup';

describe('App bootstrap (umoja-api)', () => {
  it('starts the Nest application', async () => {
    const ctx = await bootstrapE2E();
    await ctx.app.close();
  });
});
