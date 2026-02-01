import { CodeResponseType } from './code-response-type';
import { InvalidArgumentException } from '../exceptions';

describe('CodeResponseType', () => {
  it('throws when code is missing', () => {
    expect(() => new CodeResponseType('')).toThrow(InvalidArgumentException);
  });

  it('builds redirect uri with code', () => {
    const type = new CodeResponseType('abc');
    const uri = type.buildRedirectUri('https://app.test/cb');
    expect(uri.query.code).toBe('abc');
  });

  it('throws when redirectUri is missing in buildRedirectUri', () => {
    const type = new CodeResponseType('abc');
    expect(() => type.buildRedirectUri('')).toThrow(InvalidArgumentException);
  });
});
