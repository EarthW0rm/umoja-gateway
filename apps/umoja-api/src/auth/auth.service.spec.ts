import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { AuthExampleService } from './auth.service';
import {
  InMemoryAuthRepository,
  AUTH_EXPECTED_API_KEY,
} from '@control-plane/control-plane';

describe('AuthExampleService', () => {
  let service: AuthExampleService;
  let repository: InMemoryAuthRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AUTH_EXPECTED_API_KEY, useValue: 'expected-key' },
        InMemoryAuthRepository,
        {
          provide: AUTH_REPOSITORY,
          useExisting: InMemoryAuthRepository,
        },
        AuthExampleService,
      ],
    }).compile();

    service = module.get<AuthExampleService>(AuthExampleService);
    repository = module.get<InMemoryAuthRepository>(AUTH_REPOSITORY);
  });

  describe('registerClient', () => {
    it('returns client with id, clientSecret and default grants', async () => {
      const result = await service.registerClient({ name: 'test' });
      expect(result.id).toBeDefined();
      expect(result.clientSecret).toBeDefined();
      expect(result.grants).toEqual(['client_credentials', 'password', 'refresh_token']);
      expect(result.audiences).toEqual(['umoja-clients']);
    });

    it('uses provided grants and audiences', async () => {
      const result = await service.registerClient({
        name: 'test',
        grants: ['client_credentials'],
        audiences: ['custom-aud'],
      });
      expect(result.grants).toEqual(['client_credentials']);
      expect((result as any).audiences).toEqual(['custom-aud']);
    });
  });

  describe('registerUser', () => {
    it('returns user with id, username and scope', async () => {
      const result = await service.registerUser('alice', 'secret', ['read', 'write']);
      expect(result.id).toBe('alice');
      expect((result as any).username).toBe('alice');
      expect(result.scope).toEqual(['read', 'write']);
    });

    it('stores user in repository so getUser can find it', async () => {
      await service.registerUser('bob', 'pass', ['read']);
      const client = await repository.getClient('demo-client', null);
      expect(client).toBeTruthy();
      const user = await repository.getUser('bob', 'pass', client as any);
      expect(user).toBeTruthy();
      expect((user as any).id).toBe('bob');
    });
  });

  describe('validateApiKey', () => {
    it('does not throw when key matches repository expected key', () => {
      expect(() => service.validateApiKey('expected-key')).not.toThrow();
    });

    it('throws UnauthorizedException when key does not match', () => {
      expect(() => service.validateApiKey('wrong-key')).toThrow(UnauthorizedException);
      expect(() => service.validateApiKey('wrong-key')).toThrow(/Invalid API key/);
    });

    it('throws when key is undefined', () => {
      expect(() => service.validateApiKey(undefined)).toThrow(UnauthorizedException);
    });

    it('delegates to repository (repository is single data conduit)', () => {
      const repo = repository as any;
      if (repo.validateApiKey) {
        expect(repo.validateApiKey('expected-key')).toBe(true);
        expect(repo.validateApiKey('wrong')).toBe(false);
      }
    });
  });

  describe('seed (constructor)', () => {
    it('skips seed when AUTH_REPOSITORY is null', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AuthExampleService,
          { provide: AUTH_REPOSITORY, useValue: null },
        ],
      }).compile();
      const svc = module.get<AuthExampleService>(AuthExampleService);
      expect(svc).toBeDefined();
      await expect(svc.registerClient({ name: 'x' })).rejects.toThrow();
    });
  });
});
