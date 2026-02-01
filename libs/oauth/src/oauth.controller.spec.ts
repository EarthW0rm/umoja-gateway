import { OauthController } from './oauth.controller';

describe('OauthController', () => {
  const service = {
    authorize: jest.fn().mockResolvedValue('code'),
    token: jest.fn().mockResolvedValue('token'),
  } as any;

  const controller = new OauthController(service);

  it('forwards authorize requests', async () => {
    const result = await controller.authorize({} as any, {} as any);
    expect(result).toBe('code');
    expect(service.authorize).toHaveBeenCalled();
  });

  it('forwards token requests', async () => {
    const result = await controller.token({} as any, {} as any);
    expect(result).toBe('token');
    expect(service.token).toHaveBeenCalled();
  });
});
