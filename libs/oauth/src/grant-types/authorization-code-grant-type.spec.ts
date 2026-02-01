import { AuthorizationCodeGrantType } from './authorization-code-grant-type';
import {
  InvalidArgumentException,
  InvalidGrantException,
  InvalidRequestException,
  ServerException,
} from '../exceptions';

describe('AuthorizationCodeGrantType', () => {
  const client = { id: 'client', grants: ['authorization_code'], redirectUris: ['https://app.test/cb'] } as any;
  const user = { id: 'user' };

  const baseCode = {
    authorizationCode: 'code',
    expiresAt: new Date(Date.now() + 10000),
    redirectUri: 'https://app.test/cb',
    user,
    client,
    scope: ['read'],
  } as any;

  const buildRepo = (overrides: Record<string, any> = {}) =>
    ({
      getAuthorizationCode: jest.fn().mockResolvedValue(baseCode),
      revokeAuthorizationCode: jest.fn().mockResolvedValue(true),
      saveToken: jest.fn().mockImplementation(async (token: any) => token),
      validateScope: jest.fn().mockResolvedValue(['read']),
      getClient: jest.fn().mockResolvedValue(client),
      ...overrides,
    } as any);

  it('throws when repository lacks required methods', () => {
    expect(() => new AuthorizationCodeGrantType({} as any, {} as any)).toThrow(InvalidArgumentException);
  });

  it('throws when model is missing', () => {
    expect(() => new AuthorizationCodeGrantType({} as any, undefined as any)).toThrow(InvalidArgumentException);
  });

  it('throws when model does not implement getAuthorizationCode', () => {
    const model = { revokeAuthorizationCode: jest.fn(), saveToken: jest.fn() };
    expect(() => new AuthorizationCodeGrantType({} as any, model as any)).toThrow(InvalidArgumentException);
  });

  it('throws when model does not implement revokeAuthorizationCode', () => {
    const model = { getAuthorizationCode: jest.fn(), saveToken: jest.fn() };
    expect(() => new AuthorizationCodeGrantType({} as any, model as any)).toThrow(InvalidArgumentException);
  });

  it('throws when model does not implement saveToken', () => {
    const model = { getAuthorizationCode: jest.fn(), revokeAuthorizationCode: jest.fn() };
    expect(() => new AuthorizationCodeGrantType({} as any, model as any)).toThrow(InvalidArgumentException);
  });

  it('throws on missing code parameter', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(grant.handle({ body: {} }, client)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects expired codes', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, expiresAt: new Date(Date.now() - 1000) }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('rejects when PKCE verifier is missing', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, codeChallenge: 'abc', codeChallengeMethod: 'S256' }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('rejects invalid redirect URI mismatch', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: 'https://evil.test' } }, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('exchanges code for token when valid', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    const token = await grant.handle(
      { body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any,
      client,
    );
    expect(token.client).toBe(client);
    expect(token.user).toBe(user);
  });

  it('returns access denied when user denies access', async () => {
    const repo = buildRepo();
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    const request = {
      body: { code: 'code', allowed: 'false' },
      query: { allowed: 'false', client_id: client.id, response_type: 'code' },
    } as any;
    await expect(grant.handle(request, client)).rejects.toBeInstanceOf(Error);
  });

  it('accepts empty state when allowEmptyState is true', async () => {
    const grant = new AuthorizationCodeGrantType({ allowEmptyState: true } as any, buildRepo());
    const token = await grant.handle(
      { body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: { state: '' } } as any,
      client,
    );
    expect(token.client).toBe(client);
  });

  it('throws when code contains invalid redirectUri format', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, redirectUri: 'not-a-uri' }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('throws when repository returns code without user', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, user: undefined }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(ServerException);
  });

  it('throws when request is missing', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(grant.handle(undefined as any, client)).rejects.toBeInstanceOf(InvalidArgumentException);
  });

  it('throws when client is missing', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(grant.handle({ body: { code: 'code' } } as any, undefined as any)).rejects.toBeInstanceOf(
      InvalidArgumentException,
    );
  });

  it('rejects code with invalid format', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { code: 'invalid\n', redirect_uri: baseCode.redirectUri } } as any, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when code belongs to another client', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, client: { id: 'other' } }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri } } as any, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('throws when repository returns code without client', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, client: undefined }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(ServerException);
  });

  it('throws when code expiresAt is not a Date', async () => {
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({ ...baseCode, expiresAt: 'not-a-date' }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(ServerException);
  });

  it('throws when redirect_uri is missing in request and code has redirectUri', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { code: 'code' }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('throws when redirect_uri in request is not a valid URI', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: 'not-a-uri' }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when code_verifier is sent but code has no codeChallenge', async () => {
    const grant = new AuthorizationCodeGrantType({} as any, buildRepo());
    await expect(
      grant.handle(
        {
          body: { code: 'code', redirect_uri: baseCode.redirectUri, code_verifier: 'verifier' },
          query: {},
        } as any,
        client,
      ),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('rejects when revokeAuthorizationCode returns false', async () => {
    const repo = buildRepo({ revokeAuthorizationCode: jest.fn().mockResolvedValue(false) });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle({ body: { code: 'code', redirect_uri: baseCode.redirectUri }, query: {} } as any, client),
    ).rejects.toBeInstanceOf(InvalidGrantException);
  });

  it('rejects when code has codeChallenge but getHashForCodeChallenge returns null', async () => {
    const pkceUtil = require('../utils/pkce/pkce.util');
    const spy = jest.spyOn(pkceUtil, 'getHashForCodeChallenge').mockReturnValue(null);
    const repo = buildRepo({
      getAuthorizationCode: jest.fn().mockResolvedValue({
        ...baseCode,
        codeChallenge: 'challenge',
        codeChallengeMethod: 'unknown',
      }),
    });
    const grant = new AuthorizationCodeGrantType({} as any, repo);
    await expect(
      grant.handle(
        {
          body: { code: 'code', redirect_uri: baseCode.redirectUri, code_verifier: 'verifier' },
          query: {},
        } as any,
        client,
      ),
    ).rejects.toBeInstanceOf(ServerException);
    spy.mockRestore();
  });
});
