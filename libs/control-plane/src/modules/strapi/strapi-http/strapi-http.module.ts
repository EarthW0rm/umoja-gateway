import { DynamicModule, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  CONTROL_PLANE_HTTP_TIMEOUT,
  CONTROL_PLANE_STRAPI_API_TOKEN,
  CONTROL_PLANE_STRAPI_BASE_URL,
  CONTROL_PLANE_STRAPI_OPTIONS,
} from '../../../control-plane.tokens';
import { StrapiEntityViewService } from './infra/strapi-entity-view.service';
import { StrapiHttpClient } from './infra/strapi-http.client';
import { StrapiToOAuthMapperService } from './infra/strapi-to-oauth-mapper.service';
import { OAuthClientsStrapiClient } from './clients/oauth-clients.strapi-client';
import { OAuthTokensStrapiClient } from './clients/oauth-tokens.strapi-client';
import { OAuthRefreshTokensStrapiClient } from './clients/oauth-refresh-tokens.strapi-client';
import { OAuthAuthorizationCodesStrapiClient } from './clients/oauth-authorization-codes.strapi-client';
import { OAuthProductsStrapiClient } from './clients/oauth-products.strapi-client';
import { OAuthUsersStrapiClient } from './clients/oauth-users.strapi-client';
import { OAuthAudiencesStrapiClient } from './clients/oauth-audiences.strapi-client';
import { OAuthApiKeysStrapiClient } from './clients/oauth-api-keys.strapi-client';

/** Options for Strapi HTTP (same shape as ControlPlaneStrapiOptions). */
export interface StrapiHttpModuleOptions {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
}

/** Async options for StrapiHttpModule.forRootAsync. */
export interface StrapiHttpModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<StrapiHttpModuleOptions> | StrapiHttpModuleOptions;
}

const STRAPI_HTTP_PROVIDERS: Provider[] = [
  StrapiEntityViewService,
  StrapiToOAuthMapperService,
  StrapiHttpClient,
  OAuthClientsStrapiClient,
  OAuthTokensStrapiClient,
  OAuthRefreshTokensStrapiClient,
  OAuthAuthorizationCodesStrapiClient,
  OAuthProductsStrapiClient,
  OAuthUsersStrapiClient,
  OAuthAudiencesStrapiClient,
  OAuthApiKeysStrapiClient,
];

/**
 * Strapi HTTP client module. Provides a low-level StrapiHttpClient and
 * per-entity clients. Use forRoot or forRootAsync so that token providers
 * are registered in this module's context.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    }),
  ],
})
export class StrapiHttpModule {
  /**
   * Registers the Strapi HTTP layer with synchronous options.
   * Use this when options are available at module load time.
   */
  static forRoot(options: StrapiHttpModuleOptions): DynamicModule {
    const tokenProviders: Provider[] = [
      { provide: CONTROL_PLANE_STRAPI_OPTIONS, useValue: options },
      {
        provide: CONTROL_PLANE_STRAPI_BASE_URL,
        useFactory: (opts: StrapiHttpModuleOptions) => opts.baseUrl,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_STRAPI_API_TOKEN,
        useFactory: (opts: StrapiHttpModuleOptions) => opts.apiToken,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_HTTP_TIMEOUT,
        useFactory: (opts: StrapiHttpModuleOptions) => {
          const ms = opts?.timeoutMs;
          const n = typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined;
          return (n != null && n > 0 ? n : 5000);
        },
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
    ];
    return {
      module: StrapiHttpModule,
      imports: [
        HttpModule.register({
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
      providers: [...tokenProviders, ...STRAPI_HTTP_PROVIDERS],
      exports: [
        StrapiEntityViewService,
        StrapiToOAuthMapperService,
        OAuthClientsStrapiClient,
        OAuthTokensStrapiClient,
        OAuthRefreshTokensStrapiClient,
        OAuthAuthorizationCodesStrapiClient,
        OAuthProductsStrapiClient,
        OAuthUsersStrapiClient,
        OAuthAudiencesStrapiClient,
        OAuthApiKeysStrapiClient,
      ],
    };
  }

  /**
   * Registers the Strapi HTTP layer with async options.
   * Use this when options depend on ConfigService or other async providers.
   */
  static forRootAsync(options: StrapiHttpModuleAsyncOptions): DynamicModule {
    const tokenProviders: Provider[] = [
      {
        provide: CONTROL_PLANE_STRAPI_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      {
        provide: CONTROL_PLANE_STRAPI_BASE_URL,
        useFactory: (opts: StrapiHttpModuleOptions) => opts.baseUrl,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_STRAPI_API_TOKEN,
        useFactory: (opts: StrapiHttpModuleOptions) => opts.apiToken,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_HTTP_TIMEOUT,
        useFactory: (opts: StrapiHttpModuleOptions) => {
          const ms = opts?.timeoutMs;
          const n = typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined;
          return (n != null && n > 0 ? n : 5000);
        },
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
    ];
    return {
      module: StrapiHttpModule,
      imports: [
        HttpModule.register({
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' },
        }),
        ...(options.imports ?? []),
      ],
      providers: [...tokenProviders, ...STRAPI_HTTP_PROVIDERS],
      exports: [
        StrapiEntityViewService,
        StrapiToOAuthMapperService,
        OAuthClientsStrapiClient,
        OAuthTokensStrapiClient,
        OAuthRefreshTokensStrapiClient,
        OAuthAuthorizationCodesStrapiClient,
        OAuthProductsStrapiClient,
        OAuthUsersStrapiClient,
        OAuthAudiencesStrapiClient,
        OAuthApiKeysStrapiClient,
      ],
    };
  }
}
