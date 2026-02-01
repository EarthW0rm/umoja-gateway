import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedRequestException } from '../exceptions';
import { BasicAuthGuard } from './basic-auth.guard';

describe('BasicAuthGuard', () => {
  const buildContext = (request: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('returns true and attaches user when repository returns user', async () => {
    const user = { id: 'u1', username: 'alice' };
    const repository = { validateBasicAuth: jest.fn().mockResolvedValue({ user }) };
    const guard = new BasicAuthGuard(repository as any);
    const credentials = Buffer.from('alice:secret').toString('base64');
    const request = { headers: { authorization: `Basic ${credentials}` } };
    const ctx = buildContext(request);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(repository.validateBasicAuth).toHaveBeenCalledWith('alice', 'secret');
    expect((request as any).user).toEqual(user);
  });

  it('throws when Authorization header is missing', async () => {
    const repository = { validateBasicAuth: jest.fn() };
    const guard = new BasicAuthGuard(repository as any);
    const request = { headers: {} };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/missing Authorization/i);
    expect(repository.validateBasicAuth).not.toHaveBeenCalled();
  });

  it('throws when scheme is not Basic', async () => {
    const repository = { validateBasicAuth: jest.fn() };
    const guard = new BasicAuthGuard(repository as any);
    const request = { headers: { authorization: 'Bearer token' } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Basic/);
    expect(repository.validateBasicAuth).not.toHaveBeenCalled();
  });

  it('throws when Basic value is missing', async () => {
    const repository = { validateBasicAuth: jest.fn() };
    const guard = new BasicAuthGuard(repository as any);
    const request = { headers: { authorization: 'Basic' } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    expect(repository.validateBasicAuth).not.toHaveBeenCalled();
  });

  it('throws when Basic payload is invalid or has no colon', async () => {
    const repository = { validateBasicAuth: jest.fn() };
    const guard = new BasicAuthGuard(repository as any);
    const request = { headers: { authorization: 'Basic !!!invalid!!!' } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Basic auth/);
    expect(repository.validateBasicAuth).not.toHaveBeenCalled();
  });

  it('throws when decoded value has no colon (user:password format)', async () => {
    const repository = { validateBasicAuth: jest.fn() };
    const guard = new BasicAuthGuard(repository as any);
    const noColon = Buffer.from('nocolon').toString('base64');
    const request = { headers: { authorization: `Basic ${noColon}` } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/format/);
    expect(repository.validateBasicAuth).not.toHaveBeenCalled();
  });

  it('throws when repository returns null (invalid credentials)', async () => {
    const repository = { validateBasicAuth: jest.fn().mockResolvedValue(null) };
    const guard = new BasicAuthGuard(repository as any);
    const credentials = Buffer.from('bad:user').toString('base64');
    const request = { headers: { authorization: `Basic ${credentials}` } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/invalid username or password/);
    expect(repository.validateBasicAuth).toHaveBeenCalledWith('bad', 'user');
  });

  it('throws when repository does not implement validateBasicAuth', async () => {
    const repository = {};
    const guard = new BasicAuthGuard(repository as any);
    const credentials = Buffer.from('u:p').toString('base64');
    const request = { headers: { authorization: `Basic ${credentials}` } };
    const ctx = buildContext(request);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedRequestException);
  });

  it('passes username and password with colon in password', async () => {
    const user = { id: 'u2' };
    const repository = { validateBasicAuth: jest.fn().mockResolvedValue({ user }) };
    const guard = new BasicAuthGuard(repository as any);
    const credentials = Buffer.from('user:pass:with:colons').toString('base64');
    const request = { headers: { authorization: `Basic ${credentials}` } };
    const ctx = buildContext(request);
    await guard.canActivate(ctx);
    expect(repository.validateBasicAuth).toHaveBeenCalledWith('user', 'pass:with:colons');
    expect((request as any).user).toEqual(user);
  });
});
