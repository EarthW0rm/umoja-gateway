import { All, Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OauthService } from './oauth.service';

@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @All('authorize')
  async authorize(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.oauthService.authorize(req, reply);
  }

  @Post('token')
  async token(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.oauthService.token(req, reply);
  }
}
