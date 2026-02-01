import { DynamicModule, Module, Provider, ModuleMetadata } from '@nestjs/common';
import { OauthService } from './oauth.service';
import { OauthController } from './oauth.controller';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from './config/oauth.tokens';
import type { ServerOptions } from './interfaces';
import { AuthenticateHandler } from './handlers/authenticate.handler';
import { AuthorizeHandler } from './handlers/authorize.handler';
import { TokenHandler } from './handlers/token.handler';
import { OAuthGuard } from './oauth.guard';
import { OAuthOptionalGuard } from './guards/oauth-optional.guard';
import { OAuthScopeGuard } from './guards/oauth-scope.guard';
import {
  AuthorizationCodeGrantType,
  ClientCredentialsGrantType,
  PasswordGrantType,
  RefreshTokenGrantType,
} from './grant-types';

/**
 * Input payload configuring the OAuth module bootstrap (forRoot).
 * Extends ServerOptions; includeControllers toggles the built-in OauthController.
 */
export interface OauthModuleOptions extends ServerOptions {
  /** When true (default), registers OauthController for /oauth/authorize and /oauth/token. */
  includeControllers?: boolean;
}

/**
 * Input payload configuring the OAuth module bootstrap asynchronously (forRootAsync).
 * useFactory receives injected dependencies; result is merged with ServerOptions.
 */
export interface OauthModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Factory that returns OauthModuleOptions (e.g. model from AUTH_REPOSITORY). */
  useFactory: (...args: any[]) => Promise<OauthModuleOptions> | OauthModuleOptions;
  /** Injection tokens for the factory arguments (e.g. [AUTH_REPOSITORY]). */
  inject?: any[];
  /** When true (default), registers OauthController. */
  includeControllers?: boolean;
}

/**
 * Nest module that wires OAuth services, handlers, and grant types.
 */
@Module({})
export class OauthModule {
  /**
   * Registers the OAuth module with synchronous configuration.
   * @param options Input payload defining server options and controller inclusion.
   * @returns Dynamic module definition.
   */
  static forRoot(options: OauthModuleOptions): DynamicModule {
    const { includeControllers = true, ...serverOptions } = options;

    const optionsProvider: Provider = {
      provide: OAUTH2_SERVER_OPTIONS,
      useValue: serverOptions,
    };

    const providers = [
      optionsProvider,
      AuthenticateHandler,
      AuthorizeHandler,
      AuthorizationCodeGrantType,
      ClientCredentialsGrantType,
      PasswordGrantType,
      RefreshTokenGrantType,
      TokenHandler,
      OauthService,
      OAuthGuard,
      OAuthOptionalGuard,
      OAuthScopeGuard,
    ];

    return {
      module: OauthModule,
      controllers: includeControllers ? [OauthController] : [],
      providers,
      exports: [OauthService, OAuthGuard, OAuthOptionalGuard, OAuthScopeGuard],
    };
  }

  /**
   * Registers the OAuth module with async configuration factory.
   * @param options Input payload defining imports, factory, and controller inclusion.
   * @returns Dynamic module definition.
   */
  static forRootAsync(options: OauthModuleAsyncOptions): DynamicModule {
    const { includeControllers = true } = options;

    const optionsProvider: Provider = {
      provide: OAUTH2_SERVER_OPTIONS,
      useFactory: async (...args: any[]) => {
        const resolved = await options.useFactory(...args);
        const { includeControllers: _ignored, ...serverOptions } = resolved;
        return serverOptions;
      },
      inject: options.inject ?? [],
    };

    const providers: Provider[] = [
      optionsProvider,
      AuthenticateHandler,
      AuthorizeHandler,
      AuthorizationCodeGrantType,
      ClientCredentialsGrantType,
      PasswordGrantType,
      RefreshTokenGrantType,
      TokenHandler,
      OauthService,
      OAuthGuard,
      OAuthOptionalGuard,
      OAuthScopeGuard,
    ];

    return {
      module: OauthModule,
      imports: options.imports,
      controllers: includeControllers ? [OauthController] : [],
      providers,
      exports: [OauthService, OAuthGuard, OAuthOptionalGuard, OAuthScopeGuard],
    };
  }
}
