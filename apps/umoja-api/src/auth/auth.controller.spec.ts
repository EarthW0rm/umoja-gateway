import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  OAuthGuard,
  OAuthOptionalGuard,
  OAuthScopeGuard,
  ApiKeyGuard,
  BasicAuthGuard,
} from '@oauth/oauth';
import { AuthExampleController } from './auth.controller';
import { AuthExampleService } from './auth.service';

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AuthExampleController', () => {
  let controller: AuthExampleController;
  let service: AuthExampleService;

  const mockClient = {
    id: 'client-id',
    clientSecret: 'secret',
    grants: ['password'],
    redirectUris: [],
    audiences: ['umoja-clients'],
  };
  const mockUser = { id: 'user-1', username: 'alice', scope: ['read'] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthExampleController],
      providers: [
        {
          provide: AuthExampleService,
          useValue: {
            validateApiKey: jest.fn(),
            registerClient: jest.fn().mockReturnValue(mockClient),
            registerUser: jest.fn().mockReturnValue(mockUser),
          },
        },
      ],
    })
      .overrideGuard(OAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(OAuthOptionalGuard)
      .useValue(mockGuard)
      .overrideGuard(OAuthScopeGuard)
      .useValue(mockGuard)
      .overrideGuard(ApiKeyGuard)
      .useValue(mockGuard)
      .overrideGuard(BasicAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AuthExampleController>(AuthExampleController);
    service = module.get<AuthExampleService>(AuthExampleService);
  });

  describe('createClient', () => {
    it('validates API key and returns client id and secret', () => {
      const body = { name: 'test', grants: ['password'] };
      const result = controller.createClient('valid-key', body);
      expect(service.validateApiKey).toHaveBeenCalledWith('valid-key');
      expect(service.registerClient).toHaveBeenCalledWith(body);
      expect(result).toMatchObject({
        clientId: mockClient.id,
        clientSecret: mockClient.clientSecret,
        grants: mockClient.grants,
      });
    });

    it('throws when validateApiKey throws', () => {
      (service.validateApiKey as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedException('Invalid API key');
      });
      expect(() => controller.createClient('bad', { name: 'x' })).toThrow(UnauthorizedException);
    });
  });

  describe('createUser', () => {
    it('validates API key and returns user summary', () => {
      const result = controller.createUser('valid-key', {
        username: 'alice',
        password: 'secret',
        scopes: ['read'],
      });
      expect(service.validateApiKey).toHaveBeenCalledWith('valid-key');
      expect(service.registerUser).toHaveBeenCalledWith('alice', 'secret', ['read']);
      expect(result).toMatchObject({ user: { id: mockUser.id, username: 'alice', scope: ['read'] } });
    });
  });

  describe('profile', () => {
    it('returns user and scopes from request (guard attaches them)', () => {
      const req = { user: mockUser, oauth: { scopes: ['read'] } } as any;
      const result = controller.profile(req);
      expect(result).toEqual({ user: mockUser, scopes: ['read'] });
    });
  });

  describe('profileWrite', () => {
    it('returns user, scopes and write message', () => {
      const req = { user: mockUser, oauth: { scopes: ['read', 'write'] } } as any;
      const result = controller.profileWrite(req);
      expect(result).toMatchObject({ user: mockUser, message: 'write scope granted' });
      expect(result.scopes).toEqual(['read', 'write']);
    });
  });

  describe('me', () => {
    it('returns authenticated true when user is present', () => {
      const req = { user: mockUser, oauth: { scopes: ['read'] } } as any;
      const result = controller.me(req);
      expect(result).toEqual({ user: mockUser, scopes: ['read'], authenticated: true });
    });

    it('returns authenticated false when user is null', () => {
      const req = {} as any;
      const result = controller.me(req);
      expect(result).toEqual({ user: null, scopes: null, authenticated: false });
    });
  });

  describe('admin', () => {
    it('returns API key valid message', () => {
      const result = controller.admin();
      expect(result).toEqual({ message: 'API key valid', role: 'admin' });
    });
  });

  describe('session', () => {
    it('returns user and Basic auth message', () => {
      const req = { user: mockUser } as any;
      const result = controller.session(req);
      expect(result).toEqual({ user: mockUser, message: 'Basic auth valid' });
    });
  });
});
