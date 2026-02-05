'use strict';

const { join } = require('path');

const DEMO_CLIENT_SECRET = 'umoja-demo-secret';
const DEMO_API_KEY = 'umoja-api-key-demo';
const DEMO_REDIRECT_URIS = [
  'http://localhost:3000/callback',
  'http://localhost:3000/auth/callback',
];
const DEMO_CLIENT_GRANTS = ['client_credentials', 'password', 'refresh_token', 'authorization_code'];

async function createIfMissing(model, where, data) {
  const existing = await strapi.db.query(model).findOne({ where });
  if (existing) {
    return existing;
  }
  return strapi.documents(model).create({ data });
}

async function seedOAuth() {
  console.log('Seeding OAuth control plane data (idempotent)...');

  const audience = await createIfMissing(
    'api::oauth-audience.oauth-audience',
    { value: 'umoja-clients' },
    {
      value: 'umoja-clients',
      description: 'Default audience for Umoja clients',
    },
  );

  const product = await createIfMissing(
    'api::oauth-product.oauth-product',
    { name: 'umoja' },
    {
      name: 'umoja',
      description: 'Umoja product container',
      owners: ['platform@umoja.local'],
      logoUri: 'https://example.com/logo.png',
      privacyPolicyUrl: 'https://example.com/privacy',
      termsOfServiceUrl: 'https://example.com/tos',
    },
  );

  const user = await createIfMissing(
    'api::oauth-user.oauth-user',
    { username: 'demo-user' },
    {
      username: 'demo-user',
      password: 'demo-pass',
      audiences: { connect: [audience.id] },
    },
  );

  await createIfMissing(
    'api::oauth-client.oauth-client',
    { clientSecret: DEMO_CLIENT_SECRET },
    {
      redirectUris: DEMO_REDIRECT_URIS,
      clientSecret: DEMO_CLIENT_SECRET,
      grants: DEMO_CLIENT_GRANTS,
      accessTokenLifetime: 1800,
      refreshTokenLifetime: 604800,
      product: product.id,
      user: user.id,
      audiences: { connect: [audience.id] },
    },
  );

  let clientDoc = await strapi.documents('api::oauth-client.oauth-client').findFirst({
    filters: { clientSecret: DEMO_CLIENT_SECRET },
  });
  if (clientDoc?.documentId) {
    await strapi.documents('api::oauth-client.oauth-client').update({
      documentId: clientDoc.documentId,
      data: {
        grants: DEMO_CLIENT_GRANTS,
        redirectUris: DEMO_REDIRECT_URIS,
      },
    });
    clientDoc = await strapi.documents('api::oauth-client.oauth-client').findOne({
      documentId: clientDoc.documentId,
    });
  }
  const client = clientDoc ?? (await strapi.db.query('api::oauth-client.oauth-client').findOne({ where: { clientSecret: DEMO_CLIENT_SECRET } }));

  await createIfMissing(
    'api::oauth-api-key.oauth-api-key',
    { apiKey: DEMO_API_KEY },
    {
      apiKey: DEMO_API_KEY,
      description: 'Demo API key for Umoja product',
      client: client.id,
    },
  );

  console.log('OAuth seed completed with credentials:');
  console.log(`- product name: ${product.name} (id: ${product.id})`);
  const clientIdForOAuth = client.documentId ?? client.id;
  console.log(`- client_id (use in OAuth token requests): ${clientIdForOAuth}`);
  console.log(`- client secret: ${DEMO_CLIENT_SECRET}`);
  console.log(`- api key: ${DEMO_API_KEY}`);
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi({ distDir: join(__dirname, '..', 'dist') });
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  try {
    await seedOAuth();
  } catch (error) {
    console.error('Failed to seed OAuth data', error);
  }

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
