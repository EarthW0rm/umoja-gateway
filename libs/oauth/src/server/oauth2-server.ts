import { AuthenticateHandler } from '../handlers/authenticate.handler';
import { AuthorizeHandler } from '../handlers/authorize.handler';
import { TokenHandler } from '../handlers/token.handler';
import { InvalidArgumentException } from '../exceptions';
import type {
  ServerOptions,
  AuthenticateOptions,
  AuthorizeOptions,
  TokenOptions,
  OAuthToken,
  AuthorizationCode,
} from '../interfaces';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Core OAuth2 server implementation adapted for NestJS usage.
 */
export class OAuth2Server {
  constructor(
    private readonly options: ServerOptions,
    private readonly authenticateHandler: AuthenticateHandler,
    private readonly authorizeHandler: AuthorizeHandler,
    private readonly tokenHandler: TokenHandler,
  ) {
    if (!options?.model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }
  }

  authenticate(
    request: FastifyRequest,
    response: FastifyReply,
    options?: AuthenticateOptions,
  ): Promise<OAuthToken> {
    const handler = options
      ? new AuthenticateHandler(this.mergeAuthenticateOptions(options))
      : this.authenticateHandler;
    return handler.handle(request, response);
  }

  authorize(
    request: FastifyRequest,
    response: FastifyReply,
    options?: AuthorizeOptions,
  ): Promise<AuthorizationCode> {
    const handler = options ? new AuthorizeHandler(this.mergeAuthorizeOptions(options)) : this.authorizeHandler;
    return handler.handle(request, response);
  }

  token(request: FastifyRequest, response: FastifyReply, options?: TokenOptions): Promise<OAuthToken> {
    const handler = options ? new TokenHandler(this.mergeTokenOptions(options)) : this.tokenHandler;
    return handler.handle(request, response);
  }

  private mergeAuthenticateOptions(options?: AuthenticateOptions): ServerOptions {
    return {
      addAcceptedScopesHeader: true,
      addAuthorizedScopesHeader: true,
      allowBearerTokensInQueryString: false,
      ...this.options,
      ...options,
    };
  }

  private mergeAuthorizeOptions(
    options?: AuthorizeOptions,
  ): ServerOptions & { authorizationCodeLifetime: number } {
    return {
      allowEmptyState: false,
      authorizationCodeLifetime: 5 * 60,
      ...this.options,
      ...options,
    };
  }

  private mergeTokenOptions(
    options?: TokenOptions,
  ): ServerOptions & { accessTokenLifetime: number; refreshTokenLifetime: number } {
    return {
      accessTokenLifetime: 60 * 60,
      refreshTokenLifetime: 60 * 60 * 24 * 14,
      allowExtendedTokenAttributes: false,
      requireClientAuthentication: {},
      alwaysIssueNewRefreshToken: true,
      ...this.options,
      ...options,
    };
  }
}
