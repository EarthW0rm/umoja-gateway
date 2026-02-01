import { RefreshTokenGrantType } from './refresh-token-grant-type';
import {
  InvalidArgumentException,
  InvalidGrantException,
  InvalidRequestException,
  InvalidScopeException,
  ServerException,
} from '../exceptions';

describe('RefreshTokenGrantType', () => {
  const client = { id: 'client', grants: ['refresh_token'] } as any;
  const user = { id: 'user' };

  const baseToken = {
    refreshToken: 'refresh',
    refreshTokenExpiresAt: new Date(Date.now() + 10000),
    scope: ['read'],
    client,
    user,
  } as any;

  const buildRepo = (overrides: Record<string, any> = {}) =>
    ({
      getRefreshToken: jest.fn().mockResolvedValue(baseToken),
      revokeToken: jest.fn().mockResolvedValue(true),
      saveToken: jest.fn().mockImplementation(async (token: any) => token),
      validateScope: jest.fn().mockResolvedValue(['read']),
      ...overrides,
    } as any);

  it('throws when repository lacks required methods', () => {
    expect(() => new RefreshTokenGrantType({} as any, {} as any)).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement getRefreshToken', () => {
    const repo = { revokeToken: jest.fn(), saveToken: jest.fn() };
    expect(() => new RefreshTokenGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement revokeToken', () => {
    const repo = { getRefreshToken: jest.fn(), saveToken: jest.fn() };
    expect(() => new RefreshTokenGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('throws when repository does not implement saveToken', () => {
    const repo = { getRefreshToken: jest.fn(), revokeToken: jest.fn() };
    expect(() => new RefreshTokenGrantType({} as any, repo as any)).toThrow(InvalidArgumentException);
  });

  it('throws when refresh token is missing', async () => {
    const grant = new RefreshTokenGrantType({} as any, buildRepo());
    await expect(grant.handle({ body: {} }, client)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when repository returns no token', async () => {
    const repo = buildRepo({ getRefreshToken: jest.fn().mockResolvedValue(null) });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'x' } }, client)).rejects.toBeInstanceOf(
      InvalidGrantException,
    );
  });

  it('rejects when requested scope adds new scopes', async () => {
    const repo = buildRepo();
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { refresh_token: 'refresh', scope: 'read write' } }, client),
    ).rejects.toBeInstanceOf(InvalidScopeException);
  });

  it('issues new tokens when refresh token is valid', async () => {
    const repo = buildRepo();
    const grant = new RefreshTokenGrantType({} as any, repo);
    const token = await grant.handle({ body: { refresh_token: 'refresh' } }, client);
    expect(repo.revokeToken).toHaveBeenCalled();
    expect(repo.saveToken).toHaveBeenCalled();
    expect(token.client).toBe(client);
    expect(token.user).toBe(user);
  });

  it('throws when refresh token is expired', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, refreshTokenExpiresAt: new Date(Date.now() - 1000) }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('skips revoke when alwaysIssueNewRefreshToken is false', async () => {
    const repo = buildRepo();
    const grant = new RefreshTokenGrantType({ alwaysIssueNewRefreshToken: false } as any, repo);
    const token = await grant.handle({ body: { refresh_token: 'refresh' } }, client);
    expect(repo.revokeToken).not.toHaveBeenCalled();
    expect(token.refreshToken).toBeUndefined();
  });

  it('accepts subset scope request', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, scope: ['read', 'write'] }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    const token = await grant.handle({ body: { refresh_token: 'refresh', scope: 'read' } }, client);
    expect(token.scope).toEqual(['read']);
  });

  it('rejects when requesting extra scopes beyond original', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, scope: ['read'] }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { refresh_token: 'refresh', scope: 'read write' } }, client),
    ).rejects.toBeInstanceOf(InvalidScopeException);
  });

  it('rejects when refresh token client does not match', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, client: { id: 'other' } }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(
      InvalidGrantException,
    );
  });

  it('rejects when repository returns token without client', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, client: undefined }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(
      ServerException,
    );
  });

  it('rejects when repository returns token without user', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, user: undefined }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(
      ServerException,
    );
  });

  it('rejects invalid refresh_token format', async () => {
    const grant = new RefreshTokenGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { refresh_token: 'invalid\n' } }, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('throws when request is missing', async () => {
    const grant = new RefreshTokenGrantType({} as any, buildRepo());
    await expect(grant.handle(undefined as any, client)).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('throws when client is missing', async () => {
    const grant = new RefreshTokenGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { refresh_token: 'refresh' } } as any, undefined as any),
    ).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('rejects when refreshTokenExpiresAt is not a Date', async () => {
    const repo = buildRepo({
      getRefreshToken: jest.fn().mockResolvedValue({ ...baseToken, refreshTokenExpiresAt: 'not-a-date' }),
    });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(
      ServerException,
    );
  });

  it('rejects when revokeToken returns false', async () => {
    const repo = buildRepo({ revokeToken: jest.fn().mockResolvedValue(false) });
    const grant = new RefreshTokenGrantType({} as any, repo);
    await expect(grant.handle({ body: { refresh_token: 'refresh' } }, client)).rejects.toBeInstanceOf(
      InvalidGrantException,
    );
  });
});
