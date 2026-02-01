import { AuthorizeHandler } from './authorize.handler';
import { AuthenticateHandler } from './authenticate.handler';
import {
  AccessDeniedException,
  InvalidArgumentException,
  InvalidClientException,
  InvalidRequestException,
  InvalidScopeException,
  ServerException,
  UnauthorizedClientException,
  UnsupportedResponseTypeException,
} from '../exceptions';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('AuthorizeHandler', () => {
  const user = { id: 'user' };
  const client = { id: 'client', grants: ['authorization_code'], redirectUris: ['https://app.test/cb'] } as any;

  const replyFactory = () => {
    const reply: any = {
      redirectedTo: '',
      redirect(location: string) {
        reply.redirectedTo = location;
      },
    };
    return reply as unknown as FastifyReply;
  };

  const authenticateHandler = {
    handle: jest.fn().mockResolvedValue(user),
  } as unknown as AuthenticateHandler;

  const buildRepository = (overrides: Record<string, any> = {}) =>
    ({
      getClient: jest.fn().mockResolvedValue(client),
      saveAuthorizationCode: jest.fn().mockResolvedValue({
        authorizationCode: 'code',
        expiresAt: new Date(Date.now() + 10000),
        redirectUri: client.redirectUris[0],
        scope: ['read'],
      }),
      validateScope: jest.fn().mockResolvedValue(['read']),
      ...overrides,
    } as any);

  const baseRequest: any = {
    query: {
      client_id: client.id,
      response_type: 'code',
      redirect_uri: client.redirectUris[0],
      state: 'abc',
    },
    body: {},
    headers: {},
  };

  it('throws when authenticateHandler is provided but has no handle', () => {
    const badAuth = { handle: undefined } as any;
    expect(
      () => new AuthorizeHandler({ authenticateHandler: badAuth } as any, badAuth, buildRepository()),
    ).toThrow(InvalidArgumentException);
  });

  it('throws when model does not implement getClient', () => {
    const repo = { saveAuthorizationCode: jest.fn() };
    expect(
      () => new AuthorizeHandler({} as any, authenticateHandler, repo as any),
    ).toThrow(InvalidArgumentException);
  });

  it('throws when model does not implement saveAuthorizationCode', () => {
    const repo = { getClient: jest.fn().mockResolvedValue(client) };
    expect(
      () => new AuthorizeHandler({} as any, authenticateHandler, repo as any),
    ).toThrow(InvalidArgumentException);
  });

  it('completes authorization and redirects with code', async () => {
    const repo = buildRepository();
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);

    expect(code.authorizationCode).toBe('code');
    expect((reply as any).redirectedTo).toContain('code=');
  });

  it('uses allowEmptyState from options when explicitly true', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, buildRepository());
    const request = { ...baseRequest, query: { ...(baseRequest.query as any), state: undefined }, body: {} } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('uses response_type from query when not in body', async () => {
    const request = {
      ...baseRequest,
      body: {},
      query: {
        client_id: client.id,
        response_type: 'code',
        redirect_uri: client.redirectUris[0],
        state: 'x',
      },
    } as any;
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
    expect((reply as any).redirectedTo).toContain('code=');
  });

  it('rejects when client is missing grant', async () => {
    const repo = buildRepository({
      getClient: jest.fn().mockResolvedValue({ ...client, grants: ['password'] }),
    });
    const handler = new AuthorizeHandler({} as any, authenticateHandler, repo);
    await expect(handler.handle(baseRequest, replyFactory())).rejects.toBeInstanceOf(UnauthorizedClientException);
  });

  it('rejects when state is missing and empty state not allowed', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request: any = { ...baseRequest, query: { ...(baseRequest.query as any), state: undefined } };
    await expect(handler.handle(request as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when authenticate handler returns falsy user', async () => {
    const authFailHandler = { handle: jest.fn().mockResolvedValue(undefined) } as any;
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authFailHandler, buildRepository());
    await expect(handler.handle(baseRequest as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(ServerException);
  });

  it('rejects when redirect_uri is missing from client and request', async () => {
    const repo = buildRepository({
      getClient: jest.fn().mockResolvedValue({ ...client, redirectUris: [] }),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    await expect(handler.handle(baseRequest as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(InvalidClientException);
  });

  it('rejects unsupported response_type', async () => {
    const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
    const request: any = { ...baseRequest, query: { ...(baseRequest.query as any), response_type: 'token' } };
    await expect(handler.handle(request as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(UnsupportedResponseTypeException);
  });

  it('rejects invalid state characters', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request: any = { ...baseRequest, query: { ...(baseRequest.query as any), state: 'bad\n' } };
    await expect(handler.handle(request as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('wraps non-OAuth errors in catch and rethrows', async () => {
    const repo = buildRepository({
      getClient: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    const reply = replyFactory();
    await expect(handler.handle(baseRequest as FastifyRequest, reply)).rejects.toThrow();
  });

  it('redirects to error uri when error occurs after redirect_uri is resolved', async () => {
    const repo = buildRepository({
      validateScope: jest.fn().mockRejectedValue(new Error('scope failed')),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    const reply = replyFactory();
    await expect(handler.handle(baseRequest as FastifyRequest, reply)).rejects.toBeInstanceOf(ServerException);
    expect((reply as any).redirectedTo).toContain('error=');
  });

  it('uses repository generateAuthorizationCode when present', async () => {
    const customCode = jest.fn().mockResolvedValue('custom-code');
    const repo = buildRepository({
      generateAuthorizationCode: customCode,
      saveAuthorizationCode: jest.fn().mockResolvedValue({
        authorizationCode: 'custom-code',
        expiresAt: new Date(Date.now() + 10000),
        redirectUri: client.redirectUris[0],
        scope: ['read'],
      }),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code.authorizationCode).toBe('custom-code');
    expect(customCode).toHaveBeenCalledWith(client, user, ['read']);
  });

  it('reads state from body when provided', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      ...baseRequest,
      body: { state: 'state-from-body' },
      query: { ...baseRequest.query },
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
    expect((reply as any).redirectedTo).toContain('state=state-from-body');
  });

  it('reads scope from body and validates when repo has no validateScope', async () => {
    const repo = buildRepository({ validateScope: undefined });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const request = {
      ...baseRequest,
      query: { ...baseRequest.query },
      body: { scope: 'read write' },
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('reads redirect_uri from body', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      ...baseRequest,
      query: { ...baseRequest.query },
      body: { redirect_uri: client.redirectUris[0] },
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('rejects when validateScope returns false', async () => {
    const repo = buildRepository({ validateScope: jest.fn().mockResolvedValue(false) });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    const request = { ...baseRequest, body: { scope: 'read' } } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidScopeException);
  });

  it('reads response_type from body', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      ...baseRequest,
      query: { ...baseRequest.query },
      body: { response_type: 'code' },
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('rejects when response_type is missing', async () => {
    const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
    const request = { ...baseRequest, query: { ...(baseRequest.query as any), response_type: undefined } } as any;
    request.query = { client_id: client.id, redirect_uri: client.redirectUris[0], state: 'x' };
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('saves authorization code with PKCE code_challenge and code_challenge_method from query', async () => {
    const saveAuthCode = jest.fn().mockResolvedValue({
      authorizationCode: 'code',
      expiresAt: new Date(Date.now() + 10000),
      redirectUri: client.redirectUris[0],
      scope: ['read'],
    });
    const repo = buildRepository({ saveAuthorizationCode: saveAuthCode });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const request = {
      ...baseRequest,
      query: {
        ...(baseRequest.query as any),
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
      },
    } as any;
    const reply = replyFactory();
    await handler.handle(request, reply);
    expect(saveAuthCode).toHaveBeenCalledWith(
      expect.objectContaining({
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
      }),
      client,
      user,
    );
  });

  it('rejects when code_challenge_method is invalid', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      ...baseRequest,
      query: { ...(baseRequest.query as any), code_challenge: 'c', code_challenge_method: 'invalid' },
    } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('redirects with state in success url', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const reply = replyFactory();
    await handler.handle(baseRequest as FastifyRequest, reply);
    expect((reply as any).redirectedTo).toContain('state=abc');
  });

  it('accepts client with redirectUris as single string', async () => {
    const clientSingleUri = { ...client, redirectUris: 'https://app.test/cb' as any };
    const repo = buildRepository({
      getClient: jest.fn().mockResolvedValue(clientSingleUri),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code).toBeDefined();
  });

  it('rejects when allowed is false in body', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, buildRepository());
    const request = { ...baseRequest, body: { allowed: 'false' } } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(AccessDeniedException);
  });

  it('rejects when allowed is false in query', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, buildRepository());
    const request = { ...baseRequest, query: { ...(baseRequest.query as any), allowed: 'false' } } as any;
    await expect(handler.handle(request, replyFactory())).rejects.toBeInstanceOf(AccessDeniedException);
  });

  it('uses redirect_uri from query when not in body', async () => {
    const request = {
      ...baseRequest,
      body: {},
      query: {
        client_id: client.id,
        response_type: 'code',
        redirect_uri: client.redirectUris[0],
        state: 'x',
      },
    } as any;
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('validateRedirectUri uses redirectUris.includes when repo has no validateRedirectUri', async () => {
    const repo = buildRepository({ validateRedirectUri: undefined });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code).toBeDefined();
  });

  it('buildErrorRedirectUri includes error_description when error has message', async () => {
    const repo = buildRepository({
      validateScope: jest.fn().mockRejectedValue(new InvalidRequestException('scope error message')),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    const reply = replyFactory();
    await expect(handler.handle(baseRequest as FastifyRequest, reply)).rejects.toBeInstanceOf(InvalidRequestException);
    expect((reply as any).redirectedTo).toContain('error_description');
  });

  it('uses allowEmptyState false when not provided in options', async () => {
    const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code).toBeDefined();
    expect((reply as any).redirectedTo).toContain('code=');
  });

  it('uses authenticateHandler from options when provided', async () => {
    const customAuth = { handle: jest.fn().mockResolvedValue(user) } as any;
    const handler = new AuthorizeHandler(
      { allowEmptyState: false, authenticateHandler: customAuth } as any,
      authenticateHandler,
      buildRepository(),
    );
    const reply = replyFactory();
    await handler.handle(baseRequest as FastifyRequest, reply);
    expect(customAuth.handle).toHaveBeenCalledWith(baseRequest, reply);
  });

  it('reads client_id from body when provided', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      query: { response_type: 'code', redirect_uri: client.redirectUris[0], state: 'x' },
      body: { client_id: client.id },
      headers: {},
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('reads redirect_uri from body only (query without redirect_uri)', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      query: { client_id: client.id, response_type: 'code', state: 'x' },
      body: { redirect_uri: client.redirectUris[0] },
      headers: {},
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('accepts client with grants as single string', async () => {
    const clientSingleGrant = { ...client, grants: 'authorization_code' as any };
    const repo = buildRepository({
      getClient: jest.fn().mockResolvedValue(clientSingleGrant),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code).toBeDefined();
  });

  it('rejects when client has no redirectUris (undefined)', async () => {
    const repo = buildRepository({
      getClient: jest.fn().mockResolvedValue({ ...client, redirectUris: undefined }),
    });
    const handler = new AuthorizeHandler({ allowEmptyState: true } as any, authenticateHandler, repo);
    await expect(handler.handle(baseRequest as FastifyRequest, replyFactory())).rejects.toBeInstanceOf(
      InvalidClientException,
    );
  });

  it('skips validateRedirectUri when redirect_uri not in request (uses client first uri)', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      query: { client_id: client.id, response_type: 'code', state: 'x' },
      body: {},
      headers: {},
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
    expect((reply as any).redirectedTo).toContain(client.redirectUris[0]);
  });

  it('reads response_type from body when query has no response_type', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      query: { client_id: client.id, redirect_uri: client.redirectUris[0], state: 'x' },
      body: { response_type: 'code' },
      headers: {},
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
  });

  it('reads code_challenge and code_challenge_method from body', async () => {
    const saveAuthCode = jest.fn().mockResolvedValue({
      authorizationCode: 'code',
      expiresAt: new Date(Date.now() + 10000),
      redirectUri: client.redirectUris[0],
      scope: ['read'],
    });
    const repo = buildRepository({ saveAuthorizationCode: saveAuthCode });
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, repo);
    const request = {
      ...baseRequest,
      query: { ...(baseRequest.query as any) },
      body: { code_challenge: 'body-challenge', code_challenge_method: 'S256' },
    } as any;
    const reply = replyFactory();
    await handler.handle(request, reply);
    expect(saveAuthCode).toHaveBeenCalledWith(
      expect.objectContaining({
        codeChallenge: 'body-challenge',
        codeChallengeMethod: 'S256',
      }),
      client,
      user,
    );
  });

  it('updateResponse uses empty object when redirectUri.query is falsy', () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const reply = replyFactory();
    const redirectUriNoQuery = {
      protocol: 'https:',
      host: 'app.test',
      pathname: '/cb',
      path: '/cb',
      query: null as any,
      search: null,
      hash: null,
      href: 'https://app.test/cb',
    } as any;
    handler.updateResponse(reply, redirectUriNoQuery, 'state-val');
    expect((reply as any).redirectedTo).toContain('state=state-val');
  });

  it('reads all params from query when body is undefined (optional chaining branches)', async () => {
    const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
    const request = {
      query: {
        client_id: client.id,
        response_type: 'code',
        redirect_uri: client.redirectUris[0],
        state: 'x',
      },
      body: undefined,
      headers: {},
    } as any;
    const reply = replyFactory();
    const code = await handler.handle(request, reply);
    expect(code).toBeDefined();
    expect((reply as any).redirectedTo).toContain('code=');
  });

  it('uses authorizationCodeLifetime from options when provided', async () => {
    const handler = new AuthorizeHandler(
      { allowEmptyState: false, authorizationCodeLifetime: 120 } as any,
      authenticateHandler,
      buildRepository(),
    );
    const reply = replyFactory();
    const code = await handler.handle(baseRequest as FastifyRequest, reply);
    expect(code).toBeDefined();
  });

  describe('getClient branches (body vs query for client_id and redirect_uri)', () => {
    it('takes client_id from body when body has client_id', async () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = {
        body: { client_id: client.id, redirect_uri: client.redirectUris[0], response_type: 'code', state: 's' },
        query: {},
      } as any;
      const got = await handler.getClient(request);
      expect(got.id).toBe(client.id);
    });

    it('takes client_id from query when body has no client_id', async () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = {
        body: {},
        query: {
          client_id: client.id,
          redirect_uri: client.redirectUris[0],
          response_type: 'code',
          state: 's',
        },
      } as any;
      const got = await handler.getClient(request);
      expect(got.id).toBe(client.id);
    });

    it('takes redirect_uri from body when body has redirect_uri', async () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = {
        body: { client_id: client.id, redirect_uri: client.redirectUris[0], response_type: 'code', state: 's' },
        query: {},
      } as any;
      const got = await handler.getClient(request);
      expect(got).toBeDefined();
    });
  });

  describe('getRedirectUri branches', () => {
    it('takes redirect_uri from body when present in body', () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = {
        body: { redirect_uri: client.redirectUris[0] },
        query: {},
      } as any;
      const uri = handler.getRedirectUri(request, client);
      expect(uri.href).toContain(client.redirectUris[0]);
    });

    it('takes redirect_uri from query when not in body', () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = {
        body: {},
        query: { redirect_uri: client.redirectUris[0] },
      } as any;
      const uri = handler.getRedirectUri(request, client);
      expect(uri.href).toContain(client.redirectUris[0]);
    });
  });

  describe('getState branches', () => {
    it('takes state from body when present in body', () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = { body: { state: 'from-body' }, query: {} } as any;
      const s = handler.getState(request);
      expect(s).toBe('from-body');
    });

    it('takes state from query when not in body', () => {
      const handler = new AuthorizeHandler({ allowEmptyState: false } as any, authenticateHandler, buildRepository());
      const request = { body: {}, query: { state: 'from-query' } } as any;
      const s = handler.getState(request);
      expect(s).toBe('from-query');
    });
  });

  describe('getResponseType branches', () => {
    it('takes response_type from body when present in body', () => {
      const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
      const request = { body: { response_type: 'code' }, query: {} } as any;
      const Rt = handler.getResponseType(request);
      expect(Rt).toBeDefined();
    });

    it('takes response_type from query when not in body', () => {
      const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
      const request = { body: {}, query: { response_type: 'code' } } as any;
      const Rt = handler.getResponseType(request);
      expect(Rt).toBeDefined();
    });
  });

  describe('getCodeChallenge and getCodeChallengeMethod branches', () => {
    it('takes code_challenge from body when present in body', () => {
      const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
      const request = { body: { code_challenge: 'b-challenge', code_challenge_method: 'S256' }, query: {} } as any;
      expect(handler.getCodeChallenge(request)).toBe('b-challenge');
      expect(handler.getCodeChallengeMethod(request)).toBe('S256');
    });

    it('takes code_challenge from query when not in body', () => {
      const handler = new AuthorizeHandler({} as any, authenticateHandler, buildRepository());
      const request = { body: {}, query: { code_challenge: 'q-challenge', code_challenge_method: 'plain' } } as any;
      expect(handler.getCodeChallenge(request)).toBe('q-challenge');
      expect(handler.getCodeChallengeMethod(request)).toBe('plain');
    });
  });
});
