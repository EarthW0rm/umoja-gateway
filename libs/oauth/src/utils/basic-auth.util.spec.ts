import { parseBasicAuth, parseBasicAuthHeader } from './basic-auth.util';

describe('basic-auth.util', () => {
  it('parses a valid Basic header', () => {
    const header = 'Basic ' + Buffer.from('client:secret').toString('base64');
    const creds = parseBasicAuthHeader(header);
    expect(creds).toEqual({ name: 'client', pass: 'secret' });
  });

  it('returns undefined for invalid header', () => {
    expect(parseBasicAuthHeader('Bearer token')).toBeUndefined();
  });

  it('returns undefined when value is not a string', () => {
    expect(parseBasicAuthHeader(undefined)).toBeUndefined();
    expect(parseBasicAuthHeader(null as any)).toBeUndefined();
  });

  it('returns undefined when decoded payload has no colon', () => {
    const noColon = Buffer.from('nocolon').toString('base64');
    expect(parseBasicAuthHeader('Basic ' + noColon)).toBeUndefined();
  });

  it('reads credentials from request headers', () => {
    const header = 'Basic ' + Buffer.from('foo:bar').toString('base64');
    const creds = parseBasicAuth({ headers: { authorization: header } });
    expect(creds).toEqual({ name: 'foo', pass: 'bar' });
  });

  it('throws when request is missing', () => {
    expect(() => parseBasicAuth(undefined as any)).toThrow(TypeError);
  });

  it('throws when request is not an object', () => {
    expect(() => parseBasicAuth('string' as any)).toThrow(TypeError);
  });

  it('uses first element when authorization header is array', () => {
    const header = 'Basic ' + Buffer.from('a:b').toString('base64');
    const creds = parseBasicAuth({ headers: { authorization: [header] } });
    expect(creds).toEqual({ name: 'a', pass: 'b' });
  });
});
