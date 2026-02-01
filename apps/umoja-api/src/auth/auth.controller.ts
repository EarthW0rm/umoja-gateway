import { Body, Controller, Get, Headers, Post, UseGuards, Req } from '@nestjs/common';
import {
  OAuthGuard,
  OAuthOptionalGuard,
  OAuthScopeGuard,
  OAuthScopes,
  ApiKeyGuard,
  BasicAuthGuard,
} from '@oauth/oauth';
import { AuthExampleService } from './auth.service';
import type { FastifyRequest } from 'fastify';

/**
 * Demo controller that showcases OAuth guards (OAuthGuard, OAuthScopeGuard, OAuthOptionalGuard,
 * ApiKeyGuard, BasicAuthGuard) and admin endpoints for registering clients and users.
 */
@Controller('auth-demo')
export class AuthExampleController {
  /**
   * Creates the auth demo controller.
   * @param service Injected service for client/user registration and API key validation.
   */
  constructor(private readonly service: AuthExampleService) {}

  /**
   * Registers a new OAuth client (requires x-api-key header).
   * @param apiKey Value from x-api-key header.
   * @param body Input payload: name, optional grants, redirectUris, scopes, audiences.
   * @returns Output model with clientId, clientSecret, grants, audiences.
   */
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

  /**
   * Registers a new user for password grant (requires x-api-key header).
   * @param apiKey Value from x-api-key header.
   * @param body Input payload: username, password, optional scopes.
   * @returns Output model with user id, username, scope.
   */
  @Post('users')
  createUser(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() body: { username: string; password: string; scopes?: string[] },
  ) {
    this.service.validateApiKey(apiKey);
    const user = this.service.registerUser(body.username, body.password, body.scopes);
    return { user: { id: user.id, username: (user as any).username, scope: user.scope } };
  }

  /**
   * Example: route protected by OAuthGuard only (any valid token).
   */
  @Get('profile')
  @UseGuards(OAuthGuard)
  profile(@Req() req: FastifyRequest) {
    return { user: (req as any).user, scopes: (req as any).oauth?.scopes };
  }

  /**
   * Example: route protected by OAuthGuard + OAuthScopeGuard; requires 'write' scope.
   */
  @Get('profile/write')
  @UseGuards(OAuthGuard, OAuthScopeGuard)
  @OAuthScopes('write')
  profileWrite(@Req() req: FastifyRequest) {
    return { user: (req as any).user, scopes: (req as any).oauth?.scopes, message: 'write scope granted' };
  }

  /**
   * Example: optional auth via OAuthOptionalGuard; user/oauth present only when token is sent.
   */
  @Get('me')
  @UseGuards(OAuthOptionalGuard)
  me(@Req() req: FastifyRequest) {
    const user = (req as any).user ?? null;
    const scopes = (req as any).oauth?.scopes ?? null;
    return { user, scopes, authenticated: user != null };
  }

  /**
   * Example: route protected by ApiKeyGuard (x-api-key header).
   */
  @Get('admin')
  @UseGuards(ApiKeyGuard)
  admin() {
    return { message: 'API key valid', role: 'admin' };
  }

  /**
   * Example: route protected by BasicAuthGuard (Authorization: Basic base64(username:password)).
   */
  @Get('session')
  @UseGuards(BasicAuthGuard)
  session(@Req() req: FastifyRequest) {
    return { user: (req as any).user, message: 'Basic auth valid' };
  }
}
