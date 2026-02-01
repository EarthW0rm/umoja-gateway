import 'reflect-metadata';
import { OAUTH_SCOPES_KEY } from '../guards/oauth-scopes.constants';
import { OAuthScopes } from './oauth-scopes.decorator';

describe('OAuthScopes', () => {
  it('returns a decorator that sets metadata with OAUTH_SCOPES_KEY and scopes array', () => {
    const decorator = OAuthScopes('read', 'write');
    expect(typeof decorator).toBe('function');
    const target = {};
    const fn = function () {};
    const descriptor = { value: fn };
    (decorator as (t: object, k: string, d: PropertyDescriptor) => PropertyDescriptor)(target, 'testMethod', descriptor);
    const metadata = Reflect.getMetadata(OAUTH_SCOPES_KEY, fn);
    expect(metadata).toEqual(['read', 'write']);
  });

  it('sets single scope when one argument is passed', () => {
    const decorator = OAuthScopes('admin');
    const target = {};
    const fn = function () {};
    const descriptor = { value: fn };
    (decorator as (t: object, k: string, d: PropertyDescriptor) => PropertyDescriptor)(target, 'adminOnly', descriptor);
    const metadata = Reflect.getMetadata(OAUTH_SCOPES_KEY, fn);
    expect(metadata).toEqual(['admin']);
  });

  it('sets empty array when no arguments are passed', () => {
    const decorator = OAuthScopes();
    const target = {};
    const fn = function () {};
    const descriptor = { value: fn };
    (decorator as (t: object, k: string, d: PropertyDescriptor) => PropertyDescriptor)(target, 'noScope', descriptor);
    const metadata = Reflect.getMetadata(OAUTH_SCOPES_KEY, fn);
    expect(metadata).toEqual([]);
  });
});
