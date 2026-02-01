import { DynamicModule, Module, Provider, ModuleMetadata } from '@nestjs/common';
import { OauthService } from './oauth.service';
import { OauthController } from './oauth.controller';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from './config/oauth.tokens';
import type { ServerOptions } from './interfaces';
import { AuthenticateHandler } from './handlers/authenticate.handler';
import { AuthorizeHandler } from './handlers/authorize.handler';
import { TokenHandler } from './handlers/token.handler';
import { OAuthGuard } from './oauth.guard';
import {
  AuthorizationCodeGrantType,
  ClientCredentialsGrantType,
  PasswordGrantType,
  RefreshTokenGrantType,
} from './grant-types';

export interface OauthModuleOptions extends ServerOptions {
  includeControllers?: boolean;
}

export interface OauthModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<OauthModuleOptions> | OauthModuleOptions;
  inject?: any[];
  includeControllers?: boolean;
}

@Module({})
export class OauthModule {
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
    ];

    return {
      module: OauthModule,
      controllers: includeControllers ? [OauthController] : [],
      providers,
      exports: [OauthService, OAuthGuard],
    };
  }

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
    ];

    return {
      module: OauthModule,
      imports: options.imports,
      controllers: includeControllers ? [OauthController] : [],
      providers,
      exports: [OauthService, OAuthGuard],
    };
  }
}
