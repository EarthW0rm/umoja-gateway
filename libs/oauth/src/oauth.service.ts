import { Inject, Injectable, Optional } from '@nestjs/common';
import { OAUTH2_SERVER_OPTIONS } from './config/oauth.tokens';
import type { AuthenticateOptions, AuthorizeOptions, OAuthToken, AuthorizationCode, ServerOptions, TokenOptions } from './interfaces';
import { AuthenticateHandler } from './handlers/authenticate.handler';
import { AuthorizeHandler } from './handlers/authorize.handler';
import { TokenHandler } from './handlers/token.handler';
import { InvalidArgumentException } from './exceptions';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class OauthService {
  constructor(
    @Optional() @Inject(OAUTH2_SERVER_OPTIONS) private readonly options: ServerOptions,
    private readonly authenticateHandler: AuthenticateHandler,
    private readonly authorizeHandler: AuthorizeHandler,
    private readonly tokenHandler: TokenHandler,
  ) {}

  authenticate(request: FastifyRequest, response: FastifyReply, _options?: AuthenticateOptions): Promise<OAuthToken> {
    // Options overrides are not supported via manual instantiation; rely on DI-configured handler
    return this.authenticateHandler.handle(request, response);
  }

  authorize(
    request: FastifyRequest,
    response: FastifyReply,
    _options?: AuthorizeOptions,
  ): Promise<AuthorizationCode> {
    return this.authorizeHandler.handle(request, response);
  }

  token(request: FastifyRequest, response: FastifyReply, _options?: TokenOptions): Promise<OAuthToken> {
    return this.tokenHandler.handle(request, response);
  }
}
