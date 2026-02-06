import { Module, DynamicModule } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { StrapiOAuthRepository } from './strapi-oauth.repository';
import { StrapiHttpModule } from './strapi-http/strapi-http.module';

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
    return this.buildModule({
      imports: [StrapiHttpModule.forRoot(options)],
    });
  }

  /**
   * Registers the Strapi-backed AuthRepository with async factory options.
   * @param options - Async configuration for the Strapi connection.
   * @returns The configured dynamic module.
   */
  static registerAsync(options: ControlPlaneStrapiAsyncOptions): DynamicModule {
    return this.buildModule({
      imports: [
        StrapiHttpModule.forRootAsync({
          imports: options.imports,
          inject: options.inject,
          useFactory: options.useFactory,
        }),
        ...(options.imports ?? []),
      ],
    });
  }

  private static buildModule(config: {
    imports: any[];
  }): DynamicModule {
    return {
      module: ControlPlaneStrapiModule,
      imports: config.imports,
      providers: [
        StrapiOAuthRepository,
        { provide: AUTH_REPOSITORY, useExisting: StrapiOAuthRepository },
      ],
      exports: [AUTH_REPOSITORY, StrapiOAuthRepository],
    };
  }
}
