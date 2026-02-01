import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { InsufficientScopeException, UnauthorizedRequestException } from '../exceptions';
import { OAUTH_SCOPES_KEY } from './oauth-scopes.constants';

/**
 * Guard that enforces OAuth scopes set via the @OAuthScopes() decorator.
 * Must be used after OAuthGuard so that request.oauth is populated.
 * If no scopes are required (metadata absent or empty), allows access.
 */
@Injectable()
export class OAuthScopeGuard implements CanActivate {
  /**
   * Creates a scope guard that reads required scopes from handler metadata.
   * @param reflector Nest reflector to read metadata.
   */
  constructor(private readonly reflector: Reflector) {}

  /**
   * Checks that the request has an OAuth context and that token scopes include all required scopes.
   * @param context Execution context containing the HTTP request.
   * @returns True when scopes are satisfied or no scopes are required.
   * @throws {UnauthorizedRequestException} When OAuthGuard was not applied (no request.oauth).
   * @throws {InsufficientScopeException} When token scopes do not include required scopes.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(OAUTH_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const oauth = (request as FastifyRequest & { oauth?: { scopes?: string[] } }).oauth;

    if (!oauth) {
      throw new UnauthorizedRequestException(
        'Unauthorized request: OAuthScopeGuard must be used after OAuthGuard',
      );
    }

    const tokenScopes = oauth.scopes ?? [];

    const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));
    if (!hasAllScopes) {
      const authorized = tokenScopes.length ? tokenScopes.join(', ') : 'none';
      throw new InsufficientScopeException(
        `Insufficient scope: required [${requiredScopes.join(', ')}], authorized [${authorized}]`,
      );
    }

    return true;
  }
}
