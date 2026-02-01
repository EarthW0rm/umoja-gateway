import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OauthService } from './oauth.service';
import type { OAuthToken } from './interfaces';

/**
 * Guard that authenticates requests using the OAuth service and attaches the token to the request.
 */
@Injectable()
export class OAuthGuard implements CanActivate {
  /**
   * Creates an OAuth guard.
   * @param oauthService Input payload service that validates bearer tokens.
   */
  constructor(private readonly oauthService: OauthService) {}

  /**
   * Verifies the incoming request token and decorates the request with user context.
   * @param context Execution context containing HTTP request and response.
   * @returns True when authentication succeeds.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const token = (await this.oauthService.authenticate(request, reply)) as OAuthToken;
    this.attachUser(request, token);
    return true;
  }

  /**
   * Attaches user and token details to the Fastify request object.
   * @param request Input payload representing the HTTP request.
   * @param token Input payload representing the OAuth token.
   */
  private attachUser(request: FastifyRequest, token: OAuthToken) {
    const mutable = request as FastifyRequest & {
      user?: unknown;
      oauth?: { token: OAuthToken; scopes?: string[] };
    };
    mutable.user = token.user;
    mutable.oauth = {
      token,
      scopes: token.scope,
    };
  }
}
