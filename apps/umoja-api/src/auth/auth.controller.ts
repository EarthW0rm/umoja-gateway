import { Body, Controller, Get, Headers, Logger, Post, UseGuards, Req } from '@nestjs/common';
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
  private readonly logger = new Logger(AuthExampleController.name);

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
  async createClient(
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
    this.logger.log({
      msg: 'POST /auth-demo/clients received',
      hasApiKey: Boolean(apiKey),
      body: {
        name: body?.name,
        grantsCount: body?.grants?.length ?? 0,
        redirectUrisCount: body?.redirectUris?.length ?? 0,
        scopesCount: body?.scopes?.length ?? 0,
        audiencesCount: body?.audiences?.length ?? 0,
      },
    });
    try {
      this.service.validateApiKey(apiKey);
      this.logger.debug({ msg: 'API key validated' });
      const client = await this.service.registerClient(body);
      this.logger.log({
        msg: 'Client registered',
        clientId: client.id,
        grantsCount: client.grants?.length ?? 0,
      });
      return {
        clientId: client.id,
        clientSecret: client.clientSecret,
        grants: client.grants,
        audiences: (client as any).audiences,
      };
    } catch (error) {
      this.logger.error({
        msg: 'POST /auth-demo/clients failed',
        error: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
      });
      throw error;
    }
  }

  /**
   * Registers a new user for password grant (requires x-api-key header).
   * @param apiKey Value from x-api-key header.
   * @param body Input payload: username, password, optional scopes.
   * @returns Output model with user id, username, scope.
   */
  @Post('users')
  async createUser(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() body: { username: string; password: string; scopes?: string[] },
  ) {
    this.logger.log({
      msg: 'POST /auth-demo/users received',
      hasApiKey: Boolean(apiKey),
      username: body?.username,
    });
    try {
      this.service.validateApiKey(apiKey);
      const user = await this.service.registerUser(body.username, body.password, body.scopes);
      this.logger.log({ msg: 'User registered', userId: user.id, username: (user as any).username });
      return { user: { id: user.id, username: (user as any).username, scope: user.scope } };
    } catch (error) {
      this.logger.error({
        msg: 'POST /auth-demo/users failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
