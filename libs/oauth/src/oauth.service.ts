import { Inject, Injectable, Optional } from '@nestjs/common';
import { OAUTH2_SERVER_OPTIONS } from './config/oauth.tokens';
import type { AuthenticateOptions, AuthorizeOptions, OAuthToken, AuthorizationCode, ServerOptions, TokenOptions } from './interfaces';
import { AuthenticateHandler } from './handlers/authenticate.handler';
import { AuthorizeHandler } from './handlers/authorize.handler';
import { TokenHandler } from './handlers/token.handler';
import { InvalidArgumentException } from './exceptions';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Orchestrates OAuth handlers for authenticate, authorize, and token flows.
 */
@Injectable()
export class OauthService {
  /**
   * Creates the OAuth service wiring configured handlers.
   * @param options Input payload containing server-level options.
   * @param authenticateHandler Input payload handler for bearer validation.
   * @param authorizeHandler Input payload handler for authorization codes.
   * @param tokenHandler Input payload handler for token issuance.
   * @throws {InvalidArgumentException} When handlers are misconfigured.
   */
  constructor(
    @Optional() @Inject(OAUTH2_SERVER_OPTIONS) private readonly options: ServerOptions,
    private readonly authenticateHandler: AuthenticateHandler,
    private readonly authorizeHandler: AuthorizeHandler,
    private readonly tokenHandler: TokenHandler,
  ) {}

  /**
   * Validates an incoming request bearer token.
   * @param request Input payload representing the HTTP request.
   * @param response Output model used to attach headers.
   * @param _options Optional override (not supported, reserved for DI usage).
   * @returns The validated OAuth token model.
   */
  authenticate(request: FastifyRequest, response: FastifyReply, _options?: AuthenticateOptions): Promise<OAuthToken> {
    // Options overrides are not supported via manual instantiation; rely on DI-configured handler
    return this.authenticateHandler.handle(request, response);
  }

  /**
   * Initiates the authorization code flow and redirects the user agent.
   * @param request Input payload representing the HTTP request.
   * @param response Output model used for redirects.
   * @param _options Optional override (not supported, reserved for DI usage).
   * @returns The authorization code payload.
   */
  authorize(
    request: FastifyRequest,
    response: FastifyReply,
    _options?: AuthorizeOptions,
  ): Promise<AuthorizationCode> {
    return this.authorizeHandler.handle(request, response);
  }

  /**
   * Issues access and refresh tokens for supported grant types.
   * @param request Input payload representing the HTTP request.
   * @param response Output model used to return the token payload.
   * @param _options Optional override (not supported, reserved for DI usage).
   * @returns The issued OAuth token payload.
   */
  token(request: FastifyRequest, response: FastifyReply, _options?: TokenOptions): Promise<OAuthToken> {
    return this.tokenHandler.handle(request, response);
  }
}
