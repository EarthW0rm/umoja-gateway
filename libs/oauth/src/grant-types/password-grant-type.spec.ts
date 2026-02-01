import { PasswordGrantType } from './password-grant-type';
import { InvalidArgumentException, InvalidGrantException, InvalidRequestException } from '../exceptions';

describe('PasswordGrantType', () => {
  const client = { id: 'client', grants: ['password'] } as any;
  const user = { id: 'user' };

  const buildRepo = (overrides: Record<string, any> = {}) =>
    ({
      getUser: jest.fn().mockResolvedValue(user),
      saveToken: jest.fn().mockImplementation(async (token: any) => token),
      validateScope: jest.fn().mockResolvedValue(['read']),
      ...overrides,
    } as any);

  it('throws when repository lacks required methods', () => {
    expect(() => new PasswordGrantType({} as any, {} as any)).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement saveToken', () => {
    const repo = { getUser: jest.fn().mockResolvedValue(user) };
    expect(() => new PasswordGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('throws on missing username or password', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(grant.handle({ body: {} }, client)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('issues tokens for valid credentials', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    const token = await grant.handle({ body: { username: 'user', password: 'secret' } }, client);
    expect(token.user).toEqual(user);
    expect(token.client).toEqual(client);
  });

  it('rejects invalid credentials', async () => {
    const repo = buildRepo({ getUser: jest.fn().mockResolvedValue(null) });
    const grant = new PasswordGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { username: 'user', password: 'bad' } }, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('rejects invalid username format', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { username: 'bad\n', password: 'secret' } }, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects missing password', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { username: 'user' } }, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects invalid password format', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { username: 'user', password: 'bad\n' } }, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('throws when request is missing', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(grant.handle(undefined as any, client)).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('throws when client is missing', async () => {
    const grant = new PasswordGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { username: 'user', password: 'secret' } } as any, undefined as any),
    ).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('uses default scope validation when repository has no validateScope', async () => {
    const repo = buildRepo({ validateScope: undefined });
    const grant = new PasswordGrantType({} as any, repo);
    const token = await grant.handle({ body: { username: 'user', password: 'secret' } }, client);
    expect(token.scope).toBeUndefined();
  });
});
