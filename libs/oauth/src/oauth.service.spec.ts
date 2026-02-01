import { OauthService } from './oauth.service';

describe('OauthService', () => {
  const authenticateHandler = { handle: jest.fn().mockResolvedValue('auth') } as any;
  const authorizeHandler = { handle: jest.fn().mockResolvedValue('code') } as any;
  const tokenHandler = { handle: jest.fn().mockResolvedValue('token') } as any;

  const service = new OauthService({} as any, authenticateHandler, authorizeHandler, tokenHandler);

  it('delegates authenticate', async () => {
    const result = await service.authenticate({} as any, {} as any);
    expect(result).toBe('auth');
    expect(authenticateHandler.handle).toHaveBeenCalled();
  });

  it('delegates authorize', async () => {
    const result = await service.authorize({} as any, {} as any);
    expect(result).toBe('code');
    expect(authorizeHandler.handle).toHaveBeenCalled();
  });

  it('delegates token', async () => {
    const result = await service.token({} as any, {} as any);
    expect(result).toBe('token');
    expect(tokenHandler.handle).toHaveBeenCalled();
  });
});
