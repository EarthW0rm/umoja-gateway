import { base64URLEncode } from './string.util';

describe('string.util', () => {
  it('encodes string to URL-safe base64 without padding', () => {
    expect(base64URLEncode('hello')).toBe('aGVsbG8');
  });

  it('encodes Buffer to URL-safe base64 without padding', () => {
    expect(base64URLEncode(Buffer.from('hello'))).toBe('aGVsbG8');
  });
});
