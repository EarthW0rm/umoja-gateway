import { parseScope } from './scope.util';
import { InvalidScopeException } from '../exceptions';

describe('scope.util', () => {
  it('returns undefined when scope is null or undefined', () => {
    expect(parseScope(undefined)).toBeUndefined();
    expect(parseScope(null as any)).toBeUndefined();
  });

  it('parses whitespace separated scope string', () => {
    expect(parseScope('read write')).toEqual(['read', 'write']);
  });

  it('throws when scope format is invalid', () => {
    expect(() => parseScope(123 as any)).toThrow(InvalidScopeException);
    expect(() => parseScope('read\nwrite')).toThrow(InvalidScopeException);
  });
});
