import { SetMetadata } from '@nestjs/common';
import { OAUTH_SCOPES_KEY } from '../guards/oauth-scopes.constants';

/**
 * Sets the OAuth scopes required to access the route.
 * Must be used together with OAuthGuard and OAuthScopeGuard.
 *
 * @param scopes - List of scope strings the access token must include (e.g. 'read', 'write').
 * @returns Decorator that attaches scope metadata to the handler.
 *
 * @example
 * ```ts
 * @Get('admin')
 * @UseGuards(OAuthGuard, OAuthScopeGuard)
 * @OAuthScopes('admin', 'read')
 * adminOnly() { ... }
 * ```
 */
export const OAuthScopes = (...scopes: string[]) => SetMetadata(OAUTH_SCOPES_KEY, scopes);
