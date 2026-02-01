import { AuthenticateHandler } from './authenticate.handler';
import {
  InvalidArgumentException,
  InvalidRequestException,
  InvalidTokenException,
  UnauthorizedRequestException,
  InsufficientScopeException,
  ServerException,
} from '../exceptions';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('AuthenticateHandler', () => {
  const replyFactory = (): FastifyReply =>
    ({
      headers: {} as Record<string, string>,
      header(name: string, value: string) {
        (this.headers as any)[name] = value;
      },
    } as any);

  const accessToken = {
    accessToken: 'token',
    accessTokenExpiresAt: new Date(Date.now() + 10_000),
    scope: ['read'],
    client: { id: 'client' },
    user: { id: 'user' },
  } as any;

  const buildRepository = (overrides: Record<string, any> = {}) =>
    ({
      getAccessToken: jest.fn().mockResolvedValue(accessToken),
      verifyScope: jest.fn().mockResolvedValue(true),
      getClient: jest.fn().mockResolvedValue({ id: 'client', redirectUris: ['https://cb'] }),
      getAudiences: jest.fn().mockResolvedValue(['api']),
      ...overrides,
    } as any);

  const baseOptions = { addAcceptedScopesHeader: true, addAuthorizedScopesHeader: true };

  it('throws when scope is set but repository has no verifyScope', () => {
    const repo = buildRepository({ verifyScope: undefined });
    expect(() => new AuthenticateHandler({ ...baseOptions, scope: ['read'] } as any, repo)).toThrow(
      InvalidArgumentException,
    );
  });

  it('accepts options.scope when repository has verifyScope', () => {
    const repo = buildRepository();
    expect(
      () => new AuthenticateHandler({ ...baseOptions, scope: ['read'] } as any, repo),
    ).not.toThrow();
  });

  it('parses scope when options.scope is string', async () => {
    const repo = buildRepository({ verifyScope: jest.fn().mockResolvedValue(['read', 'write']) });
    const handler = new AuthenticateHandler({ ...baseOptions, scope: 'read write' } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBeDefined();
  });

  it('extracts token from Authorization header and validates scope', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = {
      headers: { authorization: 'Bearer token' },
      query: {},
      body: {},
    } as FastifyRequest;
    const reply = replyFactory();

    const token = await handler.handle(request, reply);

    expect(token).toBe(accessToken);
    expect(reply.headers['X-Accepted-OAuth-Scopes']).toBeUndefined(); // scope not configured on handler
    expect(reply.headers['X-OAuth-Scopes']).toBeUndefined();
  });

  it('rejects when multiple token sources are provided', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = {
      headers: { authorization: 'Bearer token' },
      query: { access_token: 'q' },
      body: {},
    } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when no token provided', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = { headers: {}, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(UnauthorizedRequestException);
  });

  it('rejects expired tokens', async () => {
    const repo = buildRepository({
      getAccessToken: jest.fn().mockResolvedValue({ ...accessToken, accessTokenExpiresAt: new Date(Date.now() - 1000) }),
    });
    const handler = new AuthenticateHandler(baseOptions as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('rejects query token when not allowed', async () => {
    const handler = new AuthenticateHandler({ ...baseOptions, allowBearerTokensInQueryString: false } as any, buildRepository());
    const request = { headers: {}, query: { access_token: 'q' }, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('accepts query token when allowed', async () => {
    const handler = new AuthenticateHandler(
      { ...baseOptions, allowBearerTokensInQueryString: true } as any,
      buildRepository(),
    );
    const request = { headers: {}, query: { access_token: 'q' }, body: {} } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBe(accessToken);
  });

  it('rejects body token on GET or wrong content type', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const badMethod = { method: 'GET', headers: {}, query: {}, body: { access_token: 'b' } } as any;
    await expect(handler.handle(badMethod, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);

    const badContent = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      query: {},
      body: { access_token: 'b' },
    } as any;
    await expect(handler.handle(badContent, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects invalid authorization header format', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = { headers: { authorization: 'Bearer bad token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('wraps non-OAuth errors into ServerException', async () => {
    const repo = buildRepository({
      getAccessToken: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const handler = new AuthenticateHandler(baseOptions as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(ServerException);
  });

  it('rejects when JWT verification throws', async () => {
    const repo = buildRepository();
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockImplementation(() => {
      throw new Error('jwt error');
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('rejects audience mismatch', async () => {
    const repo = buildRepository({
      getAudiences: jest.fn().mockResolvedValue(['expected']),
      getClient: jest.fn().mockResolvedValue({ id: 'client', redirectUris: ['https://cb'] }),
    });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      aud: ['other'],
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue({
      ...accessToken,
      audience: ['other'],
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('rejects when scope verification fails', async () => {
    const repo = buildRepository({ verifyScope: jest.fn().mockResolvedValue(false) });
    const handler = new AuthenticateHandler({ ...baseOptions, scope: ['read'] } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InsufficientScopeException);
  });

  it('adds scope headers when configured', async () => {
    const repo = buildRepository();
    repo.getAccessToken = jest.fn().mockResolvedValue({ ...accessToken, scope: ['read'] });
    const handler = new AuthenticateHandler({ ...baseOptions, scope: ['read'] } as any, repo);
    const reply = replyFactory();
    await handler.handle({ headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any, reply);
    expect(reply.headers['X-Accepted-OAuth-Scopes']).toBeDefined();
    expect(reply.headers['X-OAuth-Scopes']).toBeDefined();
  });

  it('extracts token from body when POST and form-urlencoded', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '10' },
      query: {},
      body: { access_token: 'body-token' },
    } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBe(accessToken);
  });

  it('rejects when getAccessToken returns token without user', async () => {
    const repo = buildRepository({
      getAccessToken: jest.fn().mockResolvedValue({ ...accessToken, user: undefined }),
    });
    const handler = new AuthenticateHandler(baseOptions as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(ServerException);
  });

  it('rejects when accessTokenExpiresAt is not a Date', async () => {
    const repo = buildRepository({
      getAccessToken: jest.fn().mockResolvedValue({ ...accessToken, accessTokenExpiresAt: 'not-a-date' }),
    });
    const handler = new AuthenticateHandler(baseOptions as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(ServerException);
  });

  it('skips scope headers when accessToken.scope is null', async () => {
    const repo = buildRepository({
      getAccessToken: jest.fn().mockResolvedValue({ ...accessToken, scope: null }),
    });
    const handler = new AuthenticateHandler({ ...baseOptions, scope: ['read'] } as any, repo);
    const reply = replyFactory();
    await handler.handle({ headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any, reply);
    expect(reply.headers['X-OAuth-Scopes']).toBeUndefined();
  });

  it('rejects when verifyAudience finds no client id in token', async () => {
    const repo = buildRepository({
      getAudiences: jest.fn().mockResolvedValue(['api']),
      getClient: jest.fn().mockResolvedValue({ id: 'client' }),
    });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      aud: ['api'],
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue({
      ...accessToken,
      client: {},
      audience: ['api'],
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('rejects when verifyAudience getClient returns null', async () => {
    const repo = buildRepository({
      getAudiences: jest.fn().mockResolvedValue(['api']),
      getClient: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      aud: ['api'],
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue({
      ...accessToken,
      audience: ['api'],
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('accepts token when verifyAudience getAudiences returns null', async () => {
    const repo = buildRepository({
      getAudiences: jest.fn().mockResolvedValue(null),
      getClient: jest.fn().mockResolvedValue({ id: 'client', redirectUris: ['https://cb'] }),
    });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      aud: ['api'],
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue({
      ...accessToken,
      audience: ['api'],
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBeDefined();
  });

  it('accepts token when repository has no getAudiences', async () => {
    const repo = buildRepository({ getAudiences: undefined });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue(accessToken);
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBeDefined();
  });

  it('extracts token when Authorization header is array', async () => {
    const handler = new AuthenticateHandler(baseOptions as any, buildRepository());
    const request = {
      headers: { authorization: ['Bearer token'] },
      query: {},
      body: {},
    } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBe(accessToken);
  });

  it('verifyAudience handles presented audience as string', async () => {
    const repo = buildRepository({
      getAudiences: jest.fn().mockResolvedValue(['api']),
      getClient: jest.fn().mockResolvedValue({ id: 'client', redirectUris: ['https://cb'] }),
    });
    jest.spyOn(require('../utils'), 'verifyAccessTokenJwt').mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user',
      cid: 'client',
      aud: 'api',
    });
    jest.spyOn(require('../utils'), 'mapPayloadToOAuthToken').mockReturnValue({
      ...accessToken,
      audience: 'api',
    });
    const handler = new AuthenticateHandler({ ...baseOptions, jwt: { secret: 's' } } as any, repo);
    const request = { headers: { authorization: 'Bearer token' }, query: {}, body: {} } as any;
    const token = await handler.handle(request, replyFactory());
    expect(token).toBeDefined();
  });
});
