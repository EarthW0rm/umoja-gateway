import { ExecutionContext } from '@nestjs/common';
import { OAuthGuard } from './oauth.guard';

describe('OAuthGuard', () => {
  const token = { user: { id: 'user' }, scope: ['read'] } as any;
  const service = {
    authenticate: jest.fn().mockResolvedValue(token),
  } as any;

  const guard = new OAuthGuard(service);

  const buildContext = () => {
    const request: any = { headers: {} };
    const response: any = {};
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  it('attaches user and oauth data to request', async () => {
    const ctx = buildContext();
    const canActivate = await guard.canActivate(ctx);
    expect(canActivate).toBe(true);
    const req = (ctx.switchToHttp() as any).getRequest();
    expect(req.user).toEqual(token.user);
    expect(req.oauth.token).toEqual(token);
  });
});
