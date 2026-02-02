import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::oauth-token.oauth-token', () => ({
  async create(ctx) {
    try {
      const response = await super.create(ctx);
      return response;
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      strapi.log.error('oauth-token create failed', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        details: err?.details ?? err?.cause ?? undefined,
        requestBody: ctx.request?.body,
      });
      throw error;
    }
  },
}));
