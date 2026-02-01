import { createHash } from './crypto.util';

describe('crypto.util', () => {
  it('creates sha256 hash buffer by default', () => {
    const digest = createHash({ data: 'hello' }) as Buffer;
    expect(Buffer.isBuffer(digest)).toBe(true);
    expect(digest.length).toBeGreaterThan(0);
  });

  it('returns encoded hash when output is provided', () => {
    const digest = createHash({ data: 'hello', output: 'hex' });
    expect(typeof digest).toBe('string');
    expect(digest).toMatch(/^[0-9a-f]+$/);
  });

  it('hashes string with explicit encoding', () => {
    const digest = createHash({ data: '68656c6c6f', encoding: 'hex' });
    expect(Buffer.isBuffer(digest)).toBe(true);
  });

  it('hashes Buffer input', () => {
    const digest = createHash({ data: Buffer.from('hello') }) as Buffer;
    expect(Buffer.isBuffer(digest)).toBe(true);
    expect(digest.length).toBeGreaterThan(0);
  });
});
