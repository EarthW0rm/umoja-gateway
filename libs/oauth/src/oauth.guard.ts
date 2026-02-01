import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OauthService } from './oauth.service';
import type { OAuthToken } from './interfaces';

@Injectable()
export class OAuthGuard implements CanActivate {
  constructor(private readonly oauthService: OauthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const token = (await this.oauthService.authenticate(request, reply)) as OAuthToken;
    this.attachUser(request, token);
    return true;
  }

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
