import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedRequestException } from '../exceptions';
import { ApiKeyGuard, DEFAULT_API_KEY_HEADER } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const buildContext = (request: any = { headers: {} }) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('returns true when repository validates the API key', () => {
    const repository = { validateApiKey: jest.fn().mockReturnValue(true) };
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: { 'x-api-key': 'valid-key' } };
    const ctx = buildContext(request);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(repository.validateApiKey).toHaveBeenCalledWith('valid-key');
  });

  it('throws UnauthorizedRequestException when repository rejects the API key', () => {
    const repository = { validateApiKey: jest.fn().mockReturnValue(false) };
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: { 'x-api-key': 'wrong-key' } };
    const ctx = buildContext(request);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedRequestException);
    expect(repository.validateApiKey).toHaveBeenCalledWith('wrong-key');
  });

  it('throws when API key header is missing (repository receives undefined)', () => {
    const repository = { validateApiKey: jest.fn().mockReturnValue(false) };
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: {} };
    const ctx = buildContext(request);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedRequestException);
    expect(repository.validateApiKey).toHaveBeenCalledWith(undefined);
  });

  it('throws when repository does not implement validateApiKey', () => {
    const repository = {};
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: { 'x-api-key': 'key' } };
    const ctx = buildContext(request);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedRequestException);
  });

  it('reads API key from x-api-key header (lowercase key)', () => {
    const repository = { validateApiKey: jest.fn().mockReturnValue(true) };
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: { 'x-api-key': 'key' } };
    const ctx = buildContext(request);
    guard.canActivate(ctx);
    expect(repository.validateApiKey).toHaveBeenCalledWith('key');
  });

  it('uses first value when header is array', () => {
    const repository = { validateApiKey: jest.fn().mockReturnValue(true) };
    const guard = new ApiKeyGuard(repository as any);
    const request = { headers: { 'x-api-key': ['first', 'second'] } };
    const ctx = buildContext(request);
    guard.canActivate(ctx);
    expect(repository.validateApiKey).toHaveBeenCalledWith('first');
  });

  it('exports DEFAULT_API_KEY_HEADER as x-api-key', () => {
    expect(DEFAULT_API_KEY_HEADER).toBe('x-api-key');
  });
});
