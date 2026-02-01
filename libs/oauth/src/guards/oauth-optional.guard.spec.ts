import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedRequestException } from '../exceptions';
import { OAuthOptionalGuard } from './oauth-optional.guard';

describe('OAuthOptionalGuard', () => {
  const token = { user: { id: 'user' }, scope: ['read'] } as any;

  const buildContext = (request: any = { headers: {} }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    }) as unknown as ExecutionContext;

  it('attaches user and oauth when authentication succeeds', async () => {
    const service = { authenticate: jest.fn().mockResolvedValue(token) } as any;
    const guard = new OAuthOptionalGuard(service);
    const ctx = buildContext();
    const canActivate = await guard.canActivate(ctx);
    expect(canActivate).toBe(true);
    const req = (ctx.switchToHttp() as any).getRequest();
    expect(req.user).toEqual(token.user);
    expect(req.oauth.scopes).toEqual(token.scope);
  });

  it('allows request without attaching user when UnauthorizedRequestException', async () => {
    const service = { authenticate: jest.fn().mockRejectedValue(new UnauthorizedRequestException()) } as any;
    const guard = new OAuthOptionalGuard(service);
    const request: any = { headers: {} };
    const ctx = buildContext(request);
    const canActivate = await guard.canActivate(ctx);
    expect(canActivate).toBe(true);
    expect(request.user).toBeUndefined();
    expect(request.oauth).toBeUndefined();
  });

  it('rethrows non-unauthorized errors', async () => {
    const otherError = new Error('Other error');
    const service = { authenticate: jest.fn().mockRejectedValue(otherError) } as any;
    const guard = new OAuthOptionalGuard(service);
    const ctx = buildContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow('Other error');
  });
});
