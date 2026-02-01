import { Inject, Injectable, Optional } from '@nestjs/common';
import { OAuth2Server } from './server/oauth2-server';
import { OAUTH2_SERVER_OPTIONS } from './config/oauth.tokens';
import type { ServerOptions } from './interfaces';
import { AuthenticateHandler } from './handlers/authenticate.handler';
import { AuthorizeHandler } from './handlers/authorize.handler';
import { TokenHandler } from './handlers/token.handler';

@Injectable()
export class OauthService extends OAuth2Server {
  constructor(
    @Optional() @Inject(OAUTH2_SERVER_OPTIONS) options: ServerOptions,
    authenticateHandler: AuthenticateHandler,
    authorizeHandler: AuthorizeHandler,
    tokenHandler: TokenHandler,
  ) {
    super(options as ServerOptions, authenticateHandler, authorizeHandler, tokenHandler);
  }
}
