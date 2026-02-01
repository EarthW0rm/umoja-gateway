import { Body, Controller, Get, Headers, Post, UseGuards, Req } from '@nestjs/common';
import { OAuthGuard } from '@oauth/oauth';
import { AuthExampleService } from './auth.service';
import type { FastifyRequest } from 'fastify';

@Controller('auth-demo')
export class AuthExampleController {
  constructor(private readonly service: AuthExampleService) {}

  @Post('clients')
  createClient(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body()
    body: {
      name: string;
      grants?: string[];
      redirectUris?: string[];
      scopes?: string[];
      audiences?: string[];
    },
  ) {
    this.service.validateApiKey(apiKey);
    const client = this.service.registerClient(body);
    return {
      clientId: client.id,
      clientSecret: client.clientSecret,
      grants: client.grants,
      audiences: (client as any).audiences,
    };
  }

  @Post('users')
  createUser(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() body: { username: string; password: string; scopes?: string[] },
  ) {
    this.service.validateApiKey(apiKey);
    const user = this.service.registerUser(body.username, body.password, body.scopes);
    return { user: { id: user.id, username: (user as any).username, scope: user.scope } };
  }

  @Get('profile')
  @UseGuards(OAuthGuard)
  profile(@Req() req: FastifyRequest) {
    return { user: (req as any).user, scopes: (req as any).oauth?.scopes };
  }
}
