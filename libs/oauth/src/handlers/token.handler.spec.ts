import { TokenHandler } from './token.handler';
import {
  InvalidArgumentException,
  InvalidClientException,
  InvalidRequestException,
  ServerException,
  UnauthorizedClientException,
  UnsupportedGrantTypeException,
} from '../exceptions';

describe('TokenHandler', () => {
  const tokenPayload = {
    accessToken: 'access',
    accessTokenExpiresAt: new Date(Date.now() + 10000),
    client: { id: 'client' },
    user: { id: 'user' },
  };

  const grantMock = {
    handle: jest.fn().mockResolvedValue(tokenPayload),
  };

  const replyStub = () => ({ header: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() });

  const buildHandler = (repoOverrides: Record<string, any> = {}, extraGrants: Record<string, any> = {}) => {
    const repository = {
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'], ...repoOverrides.client }),
      ...repoOverrides,
    } as any;

    return new TokenHandler(
      {} as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      repository,
    );
  };

  const baseRequest: any = {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { grant_type: 'password', client_id: 'client', client_secret: 'secret' },
  };

  it('rejects non-POST methods', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, method: 'GET' } as any;
    await expect(handler.handle(req, {} as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects invalid content type', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, headers: { 'content-type': 'application/json' } } as any;
    await expect(handler.handle(req, {} as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects unsupported grant type', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'] }),
    });
    const req: any = { ...baseRequest, body: { ...(baseRequest.body as any), grant_type: 'unknown' } };
    await expect(handler.handle(req, replyStub() as any)).rejects.toBeInstanceOf(UnsupportedGrantTypeException);
  });

  it('rejects when client does not allow grant type', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['client_credentials'] }),
    });
    await expect(handler.handle(baseRequest, replyStub() as any)).rejects.toBeInstanceOf(UnauthorizedClientException);
  });

  it('throws when repository lacks getClient', async () => {
    expect(
      () =>
        new TokenHandler(
          {} as any,
          grantMock as any,
          grantMock as any,
          grantMock as any,
          grantMock as any,
          {} as any,
        ),
    ).toThrow(InvalidArgumentException);
  });

  it('propagates non-OAuth errors as ServerException', async () => {
    const repo = {
      getClient: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    };
    const handler = buildHandler(repo as any);
    const reply = replyStub() as any;
    await expect(handler.handle(baseRequest, reply)).rejects.toBeInstanceOf(ServerException);
    expect(reply.status).toHaveBeenCalled();
  });

  it('issues token when grant handler succeeds', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'] }),
    });
    const reply = replyStub() as any;
    const token = await handler.handle(baseRequest, reply);
    expect(token).toEqual(tokenPayload);
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it('rejects when client_id is missing', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, body: { grant_type: 'password' } } as any;
    await expect(handler.getClient(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidClientException);
  });

  it('rejects when client_secret format is invalid', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, body: { grant_type: 'password', client_id: 'client', client_secret: 'bad\n' } } as any;
    await expect(handler.getClient(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when client_id format is invalid', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, body: { grant_type: 'password', client_id: 'bad\n', client_secret: 'secret' } } as any;
    await expect(handler.getClient(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when client_id is empty from Basic auth', async () => {
    const handler = buildHandler();
    const emptyBasic = Buffer.from(':' + 'secret').toString('base64');
    const req = {
      ...baseRequest,
      headers: { ...(baseRequest.headers as any), authorization: `Basic ${emptyBasic}` },
      body: { grant_type: 'password' },
    } as any;
    await expect(handler.getClient(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when client is null from repository', async () => {
    const handler = buildHandler({ getClient: jest.fn().mockResolvedValue(null) });
    await expect(handler.getClient(baseRequest, replyStub() as any)).rejects.toBeInstanceOf(InvalidClientException);
  });

  it('rejects when client has no grants', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: undefined }),
    });
    await expect(handler.getClient(baseRequest, replyStub() as any)).rejects.toBeInstanceOf(ServerException);
  });

  it('rejects when client_secret is missing and required for grant', async () => {
    const handler = buildHandler();
    const emptyPass = Buffer.from('client:').toString('base64');
    const req = {
      ...baseRequest,
      headers: { ...(baseRequest.headers as any), authorization: `Basic ${emptyPass}` },
      body: { grant_type: 'password' },
    } as any;
    await expect(handler.getClient(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('allows unauthenticated client when requireClientAuthentication is false', async () => {
    const handler = new TokenHandler(
      { requireClientAuthentication: { password: false } } as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      {
        getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'] }),
      } as any,
    );
    const req = { ...baseRequest, body: { grant_type: 'password', client_id: 'client' } } as any;
    const client = await handler.getClient(req, replyStub() as any);
    expect(client.id).toBe('client');
  });

  it('joins scope string in updateSuccessResponse', () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'] }),
    });
    const reply = replyStub() as any;
    handler.updateSuccessResponse(reply, new (require('../token-types/bearer-token-type').BearerTokenType)('a', 10, undefined, ['r', 'w']));
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ scope: 'r w' }));
  });

  it('updateSuccessResponse does not mutate body when scope is absent', () => {
    const handler = buildHandler();
    const reply = replyStub() as any;
    const BearerTokenType = require('../token-types/bearer-token-type').BearerTokenType;
    const tokenType = new BearerTokenType('a', 10, undefined, undefined);
    handler.updateSuccessResponse(reply, tokenType);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'a' }));
  });

  it('rejects when grant_type is missing', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, body: { client_id: 'client', client_secret: 'secret' } } as any;
    await expect(handler.handle(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('rejects when grant_type format is invalid', async () => {
    const handler = buildHandler();
    const req = { ...baseRequest, body: { grant_type: 'bad\n', client_id: 'client', client_secret: 'secret' } } as any;
    await expect(handler.handle(req, replyStub() as any)).rejects.toBeInstanceOf(InvalidRequestException);
  });

  it('challenges basic auth header when client invalid', async () => {
    const repo = {
      getClient: jest.fn().mockRejectedValue(new InvalidClientException('bad client')),
    };
    const handler = buildHandler(repo as any);
    const req: any = { ...baseRequest, headers: { ...(baseRequest.headers as any), authorization: 'Basic abc' } };
    const reply = { header: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    await expect(handler.handle(req, reply)).rejects.toBeInstanceOf(InvalidClientException);
    expect(reply.header).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Service"');
  });

  it('getClientCredentials returns client_id only when PKCE request', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'pkce-client', grants: ['authorization_code'] }),
    });
    const req = {
      ...baseRequest,
      body: {
        grant_type: 'authorization_code',
        code_verifier: 'verifier',
        client_id: 'pkce-client',
      },
    } as any;
    const client = await handler.getClient(req, replyStub() as any);
    expect(client.id).toBe('pkce-client');
  });

  it('getClient uses first element when authorization header is array', async () => {
    const handler = buildHandler({
      getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['password'] }),
    });
    const basic = Buffer.from('client:secret').toString('base64');
    const req = {
      ...baseRequest,
      headers: {
        ...(baseRequest.headers as any),
        authorization: ['Basic ' + basic],
      },
    } as any;
    const client = await handler.getClient(req, replyStub() as any);
    expect(client.id).toBe('client');
  });

  it('handleGrantType uses extendedGrantTypes when Type is class', async () => {
    const CustomGrant = class {
      handle = jest.fn().mockResolvedValue(tokenPayload);
      constructor(_opts: any) {}
    };
    const handler = new TokenHandler(
      { extendedGrantTypes: { custom_grant: CustomGrant } } as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      {
        getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['custom_grant'] }),
      } as any,
    );
    const req = {
      ...baseRequest,
      body: { grant_type: 'custom_grant', client_id: 'client', client_secret: 'secret' },
    } as any;
    const reply = replyStub() as any;
    const token = await handler.handle(req, reply);
    expect(token).toEqual(tokenPayload);
  });

  it('updateErrorResponse uses error name when getResponse has no code', () => {
    const handler = buildHandler();
    const reply = replyStub() as any;
    const { InvalidRequestException } = require('../exceptions');
    const error = new InvalidRequestException('bad');
    jest.spyOn(error, 'getResponse').mockReturnValue({});
    handler.updateErrorResponse(reply, error);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
        error_description: 'bad',
      }),
    );
  });

  it('isClientAuthenticationRequired returns false when grant type is explicitly disabled', () => {
    const handler = new TokenHandler(
      { requireClientAuthentication: { password: false } } as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      { getClient: jest.fn() } as any,
    );
    expect(handler.isClientAuthenticationRequired('password')).toBe(false);
  });

  it('throws ServerException when extendedGrantTypes class has no handle', async () => {
    const NoHandleGrant = class {
      constructor(_opts: any) {}
    };
    const handler = new TokenHandler(
      { extendedGrantTypes: { no_handle: NoHandleGrant } } as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      grantMock as any,
      {
        getClient: jest.fn().mockResolvedValue({ id: 'client', grants: ['no_handle'] }),
      } as any,
    );
    const req = {
      ...baseRequest,
      body: { grant_type: 'no_handle', client_id: 'client', client_secret: 'secret' },
    } as any;
    await expect(handler.handle(req, replyStub() as any)).rejects.toBeInstanceOf(ServerException);
  });
});
