import { ClientCredentialsGrantType } from './client-credentials-grant-type';
import { InvalidArgumentException, InvalidGrantException } from '../exceptions';

describe('ClientCredentialsGrantType', () => {
  const client = { id: 'client', grants: ['client_credentials'] } as any;
  const user = { id: 'user' };

  const buildRepo = (overrides: Record<string, any> = {}) =>
    ({
      getUserFromClient: jest.fn().mockResolvedValue(user),
      saveToken: jest.fn().mockImplementation(async (token: any) => token),
      validateScope: jest.fn().mockResolvedValue(['read']),
      ...overrides,
    } as any);

  it('throws when repository lacks required methods', () => {
    expect(
      () => new ClientCredentialsGrantType({} as any, {} as any),
    ).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement getUserFromClient', () => {
    const repo = { saveToken: jest.fn() };
    expect(() => new ClientCredentialsGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement saveToken', () => {
    const repo = { getUserFromClient: jest.fn().mockResolvedValue(user) };
    expect(() => new ClientCredentialsGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('issues a token when user is resolved', async () => {
    const repo = buildRepo();
    const grant = new ClientCredentialsGrantType({} as any, repo);
    const result = await grant.handle({ body: {} }, client);
    expect(repo.getUserFromClient).toHaveBeenCalledWith(client);
    expect(repo.saveToken).toHaveBeenCalled();
    expect(result.client).toBe(client);
    expect(result.user).toBe(user);
  });

  it('returns scope untouched when repository has no validateScope', async () => {
    const repo = buildRepo({ validateScope: undefined });
    const grant = new ClientCredentialsGrantType({} as any, repo);
    const result = await grant.handle({ body: { scope: 'read write' } }, client);
    expect(result.scope).toEqual(['read', 'write']);
  });

  it('throws when user cannot be resolved', async () => {
    const repo = buildRepo({ getUserFromClient: jest.fn().mockResolvedValue(null) });
    const grant = new ClientCredentialsGrantType({} as any, repo);
    await expect(grant.handle({ body: {} }, client)).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('throws when request is missing', async () => {
    const grant = new ClientCredentialsGrantType({} as any, buildRepo());
    await expect(grant.handle(undefined as any, client)).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('throws when client is missing', async () => {
    const grant = new ClientCredentialsGrantType({} as any, buildRepo());
    await expect(grant.handle({ body: {} } as any, undefined as any)).rejects.toBeInstanceOf(InvalidArgumentException);
  });
});
