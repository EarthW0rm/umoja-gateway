import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientScopeException, UnauthorizedRequestException } from '../exceptions';
import { OAUTH_SCOPES_KEY } from './oauth-scopes.constants';
import { OAuthScopeGuard } from './oauth-scope.guard';

describe('OAuthScopeGuard', () => {
  const buildContext = (request: any, handler?: any) =>
    ({
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('allows access when no required scopes are set', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when required scopes are empty', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue([]);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: { scopes: ['read'] } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when token has all required scopes', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['read', 'write']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: { scopes: ['read', 'write', 'admin'] } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedRequestException when request has no oauth (OAuthGuard not applied)', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['read']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedRequestException);
  });

  it('throws InsufficientScopeException when token lacks required scope', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['read', 'write']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: { scopes: ['read'] } });
    expect(() => guard.canActivate(ctx)).toThrow(InsufficientScopeException);
  });

  it('throws InsufficientScopeException when oauth.scopes is undefined (uses empty array)', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['read']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: {} });
    expect(() => guard.canActivate(ctx)).toThrow(InsufficientScopeException);
    expect(() => guard.canActivate(ctx)).toThrow(/authorized \[none\]/);
  });

  it('throws InsufficientScopeException when oauth.scopes is empty array (authorized [none])', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['write']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: { scopes: [] } });
    expect(() => guard.canActivate(ctx)).toThrow(InsufficientScopeException);
    expect(() => guard.canActivate(ctx)).toThrow(/authorized \[none\]/);
    expect(() => guard.canActivate(ctx)).toThrow(/required \[write\]/);
  });

  it('uses OAUTH_SCOPES_KEY for metadata', () => {
    const reflector = new Reflector();
    const getSpy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read']);
    const guard = new OAuthScopeGuard(reflector);
    const ctx = buildContext({ oauth: { scopes: ['read'] } });
    guard.canActivate(ctx);
    expect(getSpy).toHaveBeenCalledWith(OAUTH_SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]);
  });
});
