import { InMemoryAuthRepository } from '@control-plane/control-plane';
import type {
  OAuthClient,
  OAuthUser,
  OAuthToken,
  RefreshToken,
  AuthorizationCode,
  OAuthProduct,
} from '@oauth/oauth';

describe('InMemoryAuthRepository', () => {
  let repo: InMemoryAuthRepository;
  const client: OAuthClient = {
    id: 'c1',
    clientSecret: 'cs1',
    grants: ['password'],
    redirectUris: [],
  };
  const product: OAuthProduct = {
    id: 'p1',
    name: 'Umoja Dashboard',
    logoUri: 'https://example.com/logo.png',
    privacyPolicyUrl: 'https://example.com/privacy',
  };
  const user: OAuthUser & { password?: string } = {
    id: 'u1',
    username: 'u1',
    password: 'p1',
    scope: ['read'],
  };

  beforeEach(() => {
    repo = new InMemoryAuthRepository();
    repo.upsertClient(client);
    repo.upsertUser(user);
  });

  describe('getClient', () => {
    it('returns client when id matches and secret is null', async () => {
      const result = await repo.getClient('c1', null);
      expect(result).toEqual(client);
    });

    it('returns client when id and secret match', async () => {
      const result = await repo.getClient('c1', 'cs1');
      expect(result).toEqual(client);
    });

    it('returns null when secret does not match', async () => {
      const result = await repo.getClient('c1', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when client does not exist', async () => {
      const result = await repo.getClient('unknown', null);
      expect(result).toBeNull();
    });

    it('returns client with product metadata when product exists', async () => {
      repo.upsertProduct(product);
      repo.upsertClient({ ...client, productId: product.id });
      const result = await repo.getClient(client.id, null);
      if (!result) {
        throw new Error('Expected client to be returned');
      }
      expect(result.product).toBeTruthy();
      expect(result.productId).toBe(product.id);
      expect(result.product?.name).toBe(product.name);
    });

    it('stores embedded product metadata and links productId', async () => {
      const embeddedProduct: OAuthProduct = {
        id: 'p2',
        name: 'Embedded Product',
        termsOfServiceUrl: 'https://example.com/tos',
      };
      repo.upsertClient({ ...client, id: 'c2', product: embeddedProduct });
      const found = await repo.getClient('c2', null);
      if (!found) {
        throw new Error('Expected client to be returned');
      }
      expect(found.productId).toBe(embeddedProduct.id);
      expect(found.product?.name).toBe(embeddedProduct.name);
    });
  });

  describe('saveToken / getAccessToken', () => {
    it('stores and retrieves access token', async () => {
      const token: OAuthToken = {
        accessToken: 'at1',
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
        client,
        user,
        scope: ['read'],
      };
      await repo.saveToken(token, client, user);
      const found = await repo.getAccessToken('at1');
      expect(found).toBeTruthy();
      expect((found as OAuthToken).accessToken).toBe('at1');
      expect((found as OAuthToken).user).toEqual(user);
    });

    it('returns null for unknown access token', async () => {
      const found = await repo.getAccessToken('unknown');
      expect(found).toBeNull();
    });
  });

  describe('verifyScope', () => {
    it('returns true when token has all required scopes', async () => {
      const token = { scope: ['read', 'write'] } as OAuthToken;
      const result = await repo.verifyScope(token, ['read', 'write']);
      expect(result).toBe(true);
    });

    it('returns false when token misses a scope', async () => {
      const token = { scope: ['read'] } as OAuthToken;
      const result = await repo.verifyScope(token, ['read', 'write']);
      expect(result).toBe(false);
    });

    it('returns false when token has no scope', async () => {
      const token = {} as OAuthToken;
      const result = await repo.verifyScope(token, ['read']);
      expect(result).toBe(false);
    });
  });

  describe('getUser', () => {
    it('returns user when username and password match', async () => {
      const result = await repo.getUser('u1', 'p1', client);
      expect(result).toEqual(user);
    });

    it('returns null when password is wrong', async () => {
      const result = await repo.getUser('u1', 'wrong', client);
      expect(result).toBeNull();
    });

    it('returns null when user does not exist', async () => {
      const result = await repo.getUser('unknown', 'p1', client);
      expect(result).toBeNull();
    });
  });

  describe('getUserFromClient', () => {
    it('returns user when client has userId', async () => {
      repo.upsertClient({ ...client, userId: 'u1' });
      const result = await repo.getUserFromClient({ ...client, userId: 'u1' });
      expect(result).toEqual(user);
    });

    it('returns null when client has no userId', async () => {
      const result = await repo.getUserFromClient(client);
      expect(result).toBeNull();
    });

    it('returns null when client userId does not match any user', async () => {
      const result = await repo.getUserFromClient({ ...client, userId: 'nonexistent' });
      expect(result).toBeNull();
    });
  });

  describe('getRefreshToken / revokeToken', () => {
    it('stores refresh token via saveToken and retrieves it', async () => {
      const token: OAuthToken = {
        accessToken: 'at2',
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'rt1',
        refreshTokenExpiresAt: new Date(Date.now() + 86400000),
        client,
        user,
      };
      await repo.saveToken(token, client, user);
      const found = await repo.getRefreshToken('rt1');
      expect(found).toBeTruthy();
      expect((found as RefreshToken).refreshToken).toBe('rt1');
    });

    it('revokeToken removes the refresh token', async () => {
      const token: OAuthToken = {
        accessToken: 'at3',
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
        refreshToken: 'rt2',
        refreshTokenExpiresAt: new Date(Date.now() + 86400000),
        client,
        user,
      };
      await repo.saveToken(token, client, user);
      const revoked = await repo.revokeToken({ refreshToken: 'rt2', client, user } as RefreshToken);
      expect(revoked).toBe(true);
      const found = await repo.getRefreshToken('rt2');
      expect(found).toBeNull();
    });

    it('revokeToken returns false when refreshToken is empty', async () => {
      const revoked = await repo.revokeToken({ refreshToken: '', client, user } as RefreshToken);
      expect(revoked).toBe(false);
    });
  });

  describe('generateAccessToken / generateRefreshToken / generateAuthorizationCode', () => {
    it('generateAccessToken returns hex string', async () => {
      const token = await repo.generateAccessToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[a-f0-9]+$/);
      expect(token.length).toBe(64);
    });

    it('generateRefreshToken returns hex string', async () => {
      const token = await repo.generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('generateAuthorizationCode returns hex string', async () => {
      const code = await repo.generateAuthorizationCode();
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('getAuthorizationCode / saveAuthorizationCode / revokeAuthorizationCode', () => {
    it('saves and retrieves authorization code', async () => {
      const codePayload = {
        authorizationCode: 'code1',
        expiresAt: new Date(Date.now() + 60000),
        redirectUri: 'https://example.com/cb',
        scope: ['read'],
      };
      await repo.saveAuthorizationCode(codePayload, client, user);
      const found = await repo.getAuthorizationCode('code1');
      expect(found).toBeTruthy();
      expect((found as AuthorizationCode).authorizationCode).toBe('code1');
      expect((found as AuthorizationCode).client).toEqual(client);
      expect((found as AuthorizationCode).user).toEqual(user);
    });

    it('revokeAuthorizationCode removes the code', async () => {
      const codePayload = {
        authorizationCode: 'code2',
        expiresAt: new Date(Date.now() + 60000),
        redirectUri: 'https://example.com/cb',
      };
      await repo.saveAuthorizationCode(codePayload, client, user);
      const revoked = await repo.revokeAuthorizationCode({
        authorizationCode: 'code2',
        expiresAt: codePayload.expiresAt,
        redirectUri: codePayload.redirectUri,
        client,
        user,
      } as AuthorizationCode);
      expect(revoked).toBe(true);
      const found = await repo.getAuthorizationCode('code2');
      expect(found).toBeNull();
    });

    it('revokeAuthorizationCode returns false when code was not stored', async () => {
      const revoked = await repo.revokeAuthorizationCode({
        authorizationCode: 'nonexistent',
        expiresAt: new Date(),
        redirectUri: 'https://example.com/cb',
        client,
        user,
      } as AuthorizationCode);
      expect(revoked).toBe(false);
    });
  });

  describe('getProduct / getProductClients / upsertProduct', () => {
    it('returns product with linked clients when present', async () => {
      repo.upsertProduct(product);
      repo.upsertClient({ ...client, productId: product.id });
      const result = await repo.getProduct(product.id);
      if (!result) {
        throw new Error('Expected product to be returned');
      }
      expect(result.id).toBe(product.id);
      expect(result.clients).toBeTruthy();
      expect(result.clients?.[0].id).toBe(client.id);
    });

    it('getProduct returns null when product does not exist', async () => {
      const result = await repo.getProduct('missing');
      expect(result).toBeNull();
    });

    it('getProductClients returns empty array when product exists without clients', async () => {
      repo.upsertProduct(product);
      const result = await repo.getProductClients(product.id);
      expect(result).toBeTruthy();
      expect((result as OAuthClient[]).length).toBe(0);
    });

    it('getProductClients returns null when product does not exist', async () => {
      const result = await repo.getProductClients('missing');
      expect(result).toBeNull();
    });
  });

  describe('upsertClient / upsertUser', () => {
    it('upsertClient overwrites existing client', async () => {
      const updated = { ...client, id: 'c1', clientSecret: 'new-secret' };
      const result = repo.upsertClient(updated);
      expect(result).toEqual(updated);
      const found = await repo.getClient('c1', null);
      expect(found).toEqual(updated);
    });

    it('upsertUser overwrites existing user', () => {
      const updated = { ...user, id: 'u1', username: 'u1', password: 'new-pass' };
      const result = repo.upsertUser(updated);
      expect(result).toEqual(updated);
    });

    it('upsertUser uses username as key when id is undefined', async () => {
      const userNoId = {
        username: 'no-id-user',
        password: 'p',
        scope: ['read'],
      } as OAuthUser & { password?: string };
      repo.upsertUser(userNoId);
      const found = await repo.getUser('no-id-user', 'p', client);
      expect(found).toBeTruthy();
      expect((found as OAuthUser).username).toBe('no-id-user');
    });
  });

  describe('validateApiKey', () => {
    it('returns true when apiKey matches default expected key (changeme)', () => {
      expect(repo.validateApiKey!('changeme')).toBe(true);
    });

    it('returns false when apiKey does not match', () => {
      expect(repo.validateApiKey!('wrong')).toBe(false);
    });

    it('returns false when apiKey is undefined', () => {
      expect(repo.validateApiKey!(undefined)).toBe(false);
    });

    it('uses custom expected key when provided via constructor', () => {
      const repoWithKey = new InMemoryAuthRepository('my-secret');
      expect(repoWithKey.validateApiKey!('my-secret')).toBe(true);
      expect(repoWithKey.validateApiKey!('changeme')).toBe(false);
    });
  });

  describe('validateBasicAuth', () => {
    const demoClient: OAuthClient = {
      id: 'demo-client',
      clientSecret: 'demo-secret',
      grants: ['password'],
      redirectUris: [],
    };

    it('returns user when credentials match (demo-client)', async () => {
      repo.upsertClient(demoClient);
      repo.upsertUser({
        id: 'alice',
        username: 'alice',
        password: 'secret',
        scope: ['read'],
      });
      const result = await repo.validateBasicAuth!('alice', 'secret');
      expect(result).toBeTruthy();
      expect(result!.user).toBeTruthy();
      expect((result!.user as OAuthUser).username).toBe('alice');
    });

    it('returns null when password is wrong', async () => {
      repo.upsertClient(demoClient);
      repo.upsertUser({
        id: 'alice',
        username: 'alice',
        password: 'secret',
        scope: ['read'],
      });
      const result = await repo.validateBasicAuth!('alice', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user does not exist', async () => {
      repo.upsertClient(demoClient);
      const result = await repo.validateBasicAuth!('unknown', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when demo-client does not exist', async () => {
      const emptyRepo = new InMemoryAuthRepository();
      const result = await emptyRepo.validateBasicAuth!('any', 'any');
      expect(result).toBeNull();
    });
  });

  describe('getAudiences', () => {
    it('returns default umoja-clients when client and user have no audiences', async () => {
      const result = await repo.getAudiences(client, user);
      expect(result).toEqual(['umoja-clients']);
    });

    it('returns combined audiences from client and user', async () => {
      const clientWithAud = { ...client, audiences: ['aud1'] };
      const userWithAud = { ...user, audiences: ['aud2'] };
      const result = await repo.getAudiences(clientWithAud as any, userWithAud as any);
      expect(result).toEqual(expect.arrayContaining(['aud1', 'aud2']));
      expect((result as string[]).length).toBe(2);
    });

    it('normalizes string audience to array', async () => {
      const clientWithAud = { ...client, audiences: 'single-aud' as any };
      const result = await repo.getAudiences(clientWithAud as any, user);
      expect(result).toEqual(['single-aud']);
    });

    it('ignores non-array non-string audience and returns default', async () => {
      const clientWithAud = { ...client, audiences: 123 as any };
      const result = await repo.getAudiences(clientWithAud as any, user);
      expect(result).toEqual(['umoja-clients']);
    });
  });
});
