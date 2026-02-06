import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StrapiHttpClient } from './infra/strapi-http.client';
import { OAuthClientsStrapiClient } from './clients/oauth-clients.strapi-client';
import { OAuthTokensStrapiClient } from './clients/oauth-tokens.strapi-client';
import { OAuthRefreshTokensStrapiClient } from './clients/oauth-refresh-tokens.strapi-client';
import { OAuthAuthorizationCodesStrapiClient } from './clients/oauth-authorization-codes.strapi-client';
import { OAuthProductsStrapiClient } from './clients/oauth-products.strapi-client';
import { OAuthUsersStrapiClient } from './clients/oauth-users.strapi-client';
import { OAuthAudiencesStrapiClient } from './clients/oauth-audiences.strapi-client';
import { OAuthApiKeysStrapiClient } from './clients/oauth-api-keys.strapi-client';

/**
 * Strapi HTTP client module. Provides a low-level StrapiHttpClient and
 * per-entity clients for oauth-clients, oauth-tokens, oauth-refresh-tokens,
 * oauth-authorization-codes, oauth-products, oauth-users, oauth-audiences,
 * and oauth-api-keys.
 *
 * Requires the host module to provide:
 * - CONTROL_PLANE_STRAPI_BASE_URL
 * - CONTROL_PLANE_STRAPI_API_TOKEN
 * - CONTROL_PLANE_HTTP_TIMEOUT
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    }),
  ],
  providers: [
    StrapiHttpClient,
    OAuthClientsStrapiClient,
    OAuthTokensStrapiClient,
    OAuthRefreshTokensStrapiClient,
    OAuthAuthorizationCodesStrapiClient,
    OAuthProductsStrapiClient,
    OAuthUsersStrapiClient,
    OAuthAudiencesStrapiClient,
    OAuthApiKeysStrapiClient,
  ],
  exports: [
    OAuthClientsStrapiClient,
    OAuthTokensStrapiClient,
    OAuthRefreshTokensStrapiClient,
    OAuthAuthorizationCodesStrapiClient,
    OAuthProductsStrapiClient,
    OAuthUsersStrapiClient,
    OAuthAudiencesStrapiClient,
    OAuthApiKeysStrapiClient,
  ],
})
export class StrapiHttpModule {}
