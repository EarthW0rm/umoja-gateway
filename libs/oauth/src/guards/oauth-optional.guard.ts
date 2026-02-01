import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OauthService } from '../oauth.service';
import type { OAuthToken } from '../interfaces';
import { UnauthorizedRequestException } from '../exceptions';

/**
 * Guard that optionally authenticates requests: if a valid bearer token is present,
 * it attaches user and OAuth context to the request; if absent or invalid, the request
 * continues without user/oauth (does not throw).
 * Use for routes that behave differently for authenticated vs anonymous users.
 */
@Injectable()
export class OAuthOptionalGuard implements CanActivate {
  /**
   * Creates an optional OAuth guard.
   * @param oauthService Service that validates bearer tokens.
   */
  constructor(private readonly oauthService: OauthService) {}

  /**
   * Tries to authenticate the request; on success attaches user and oauth to the request.
   * On missing/invalid token, allows the request to proceed without throwing.
   * @param context Execution context containing HTTP request and response.
   * @returns True so that the request always continues (auth is optional).
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    try {
      const token = (await this.oauthService.authenticate(request, reply)) as OAuthToken;
      this.attachUser(request, token);
    } catch (error) {
      if (error instanceof UnauthorizedRequestException) {
        return true;
      }
      throw error;
    }
    return true;
  }

  /**
   * Attaches user and token details to the Fastify request object.
   * @param request HTTP request to mutate.
   * @param token Validated OAuth token.
   */
  private attachUser(request: FastifyRequest, token: OAuthToken): void {
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
