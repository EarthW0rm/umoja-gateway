import { All, Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OauthService } from './oauth.service';

/**
 * Exposes OAuth endpoints for authorization and token issuance.
 */
@Controller('oauth')
export class OauthController {
  /**
   * Creates the OAuth controller.
   * @param oauthService Input payload service orchestrating OAuth flows.
   */
  constructor(private readonly oauthService: OauthService) {}

  @All('authorize')
  /**
   * Handles authorization requests for user-agent based flows.
   * @param req Input payload representing the HTTP request.
   * @param reply Output model for redirect responses.
   * @returns Authorization code payload.
   */
  async authorize(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.oauthService.authorize(req, reply);
  }

  @Post('token')
  /**
   * Issues tokens for supported grant types.
   * @param req Input payload representing the HTTP request.
   * @param reply Output model returning token payloads.
   * @returns OAuth token payload.
   */
  async token(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.oauthService.token(req, reply);
  }
}
