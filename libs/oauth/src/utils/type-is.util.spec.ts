import { hasBody, mimeMatch, normalize, requestType, typeIs } from './type-is.util';

describe('type-is.util', () => {
  it('matches content-type against provided types', () => {
    expect(typeIs('application/json', 'json')).toBe('json');
    expect(typeIs('text/html', ['json', 'html'])).toBe('html');
    expect(typeIs('application/xml', 'json')).toBe(false);
  });

  it('returns normalized type when no target provided', () => {
    expect(typeIs('text/plain')).toBe('text/plain');
  });

  it('evaluates request content type', () => {
    const req = { headers: { 'content-type': 'application/json', 'content-length': '10' } };
    expect(requestType(req, 'json')).toBe('json');
  });

  it('returns null when request has no body', () => {
    const req = { headers: {} };
    expect(requestType(req, 'json')).toBeNull();
  });

  it('handles request with undefined headers in getHeaderValue path', () => {
    expect(hasBody({ headers: undefined })).toBe(false);
    expect(requestType({ headers: undefined } as any, 'json')).toBeNull();
  });

  it('detects if request has body headers', () => {
    expect(hasBody({ headers: { 'content-length': '0' } })).toBe(true);
    expect(hasBody({ headers: {} })).toBe(false);
  });

  it('normalizes shorthand media types', () => {
    expect(normalize('urlencoded')).toBe('application/x-www-form-urlencoded');
    expect(normalize('+json')).toBe('*/*+json');
    expect(normalize('multipart')).toBe('multipart/*');
  });

  it('returns false for invalid normalize input', () => {
    expect(normalize(undefined as any)).toBe(false);
    expect(normalize('unknown')).toBe(false);
  });

  it('matches mime patterns with wildcards', () => {
    expect(mimeMatch('text/*', 'text/plain')).toBe(true);
    expect(mimeMatch('application/*+json', 'application/vnd.api+json')).toBe(true);
    expect(mimeMatch('image/*', 'text/plain')).toBe(false);
  });

  it('mimeMatch returns false when expected is null or false', () => {
    expect(mimeMatch(null, 'text/plain')).toBe(false);
    expect(mimeMatch(false as any, 'text/plain')).toBe(false);
  });

  it('mimeMatch returns false when type has wrong number of parts', () => {
    expect(mimeMatch('invalid', 'text/plain')).toBe(false);
  });

  it('typeIs returns value when types is empty array', () => {
    expect(typeIs('application/json', [])).toBe('application/json');
  });

  it('requestType uses first element when content-type header is array', () => {
    const req = {
      headers: { 'content-type': ['application/json'], 'content-length': '10' },
    };
    expect(requestType(req as any, 'json')).toBe('json');
  });

  it('requestType returns false when request has body but no content-type header', () => {
    const req = { headers: { 'content-length': '10' } };
    expect(requestType(req, 'json')).toBe(false);
  });

  it('requestType returns false when content-type header is explicitly undefined', () => {
    const req = { headers: { 'content-length': '10', 'content-type': undefined } };
    expect(requestType(req as any, 'json')).toBe(false);
  });

  it('hasBody uses first element when transfer-encoding header is array', () => {
    const req = { headers: { 'transfer-encoding': ['chunked'] } };
    expect(hasBody(req)).toBe(true);
  });

  it('returns false when value cannot be normalized', () => {
    expect(typeIs(undefined, 'json')).toBe(false);
  });

  it('returns false when value causes normalize to throw', () => {
    expect(typeIs(123 as any, 'json')).toBe(false);
  });

  it('returns false when value normalizes to empty type', () => {
    expect(typeIs('  ;  ', 'json')).toBe(false);
  });

  it('returns false when request has invalid content-type', () => {
    const req = { headers: { 'content-type': 'invalid', 'content-length': '10' } };
    expect(requestType(req as any, 'json')).toBe(false);
  });

  it('handles wildcard matching with plus suffix', () => {
    expect(typeIs('application/vnd.api+json', ['application/*+json'])).toBe('application/vnd.api+json');
  });
});
