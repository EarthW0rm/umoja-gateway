import { Module, DynamicModule, Provider } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import {
  CONTROL_PLANE_HTTP_TIMEOUT,
  CONTROL_PLANE_STRAPI_API_TOKEN,
  CONTROL_PLANE_STRAPI_BASE_URL,
  CONTROL_PLANE_STRAPI_OPTIONS,
} from '../../control-plane.tokens';
import { StrapiOAuthRepository } from './strapi-oauth.repository';

/**
 * Options required to wire the Strapi-backed repository.
 */
export interface ControlPlaneStrapiOptions {
  /**
   * Base URL pointing to the Strapi instance (without /api).
   */
  baseUrl: string;
  /**
   * API token used to authenticate against Strapi.
   */
  apiToken: string;
  /**
   * Timeout in milliseconds for Strapi HTTP requests.
   */
  timeoutMs?: number;
}

/**
 * Async options for registering the Strapi-backed repository.
 */
export interface ControlPlaneStrapiAsyncOptions {
  /**
   * Dependencies to import before resolving the factory.
   */
  imports?: any[];
  /**
   * Provider tokens to inject into the useFactory.
   */
  inject?: any[];
  /**
   * Factory that returns the Strapi options object.
   */
  useFactory: (...args: any[]) => Promise<ControlPlaneStrapiOptions> | ControlPlaneStrapiOptions;
}

/**
 * Control Plane module exposing the Strapi-backed AuthRepository.
 */
@Module({})
export class ControlPlaneStrapiModule {
  /**
   * Registers the Strapi-backed AuthRepository and supporting providers.
   * @param options - Configuration for the Strapi connection.
   * @returns The configured dynamic module.
   */
  static register(options: ControlPlaneStrapiOptions): DynamicModule {
    const optionProviders: Provider[] = [
      {
        provide: CONTROL_PLANE_STRAPI_OPTIONS,
        useValue: options,
      },
    ];
    return this.buildModule(optionProviders);
  }

  /**
   * Registers the Strapi-backed AuthRepository with async factory options.
   * @param options - Async configuration for the Strapi connection.
   * @returns The configured dynamic module.
   */
  static registerAsync(options: ControlPlaneStrapiAsyncOptions): DynamicModule {
    const optionProviders: Provider[] = [
      {
        provide: CONTROL_PLANE_STRAPI_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
    ];
    return this.buildModule(optionProviders, options.imports);
  }

  private static buildModule(optionProviders: Provider[], imports?: any[]): DynamicModule {
    const providers: Provider[] = [
      ...optionProviders,
      {
        provide: CONTROL_PLANE_STRAPI_BASE_URL,
        useFactory: (opts: ControlPlaneStrapiOptions) => opts.baseUrl,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_STRAPI_API_TOKEN,
        useFactory: (opts: ControlPlaneStrapiOptions) => opts.apiToken,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      {
        provide: CONTROL_PLANE_HTTP_TIMEOUT,
        useFactory: (opts: ControlPlaneStrapiOptions) => opts.timeoutMs ?? 5000,
        inject: [CONTROL_PLANE_STRAPI_OPTIONS],
      },
      StrapiOAuthRepository,
      {
        provide: AUTH_REPOSITORY,
        useExisting: StrapiOAuthRepository,
      },
    ];

    return {
      module: ControlPlaneStrapiModule,
      imports: imports ?? [],
      providers,
      exports: [AUTH_REPOSITORY, StrapiOAuthRepository],
    };
  }
}
