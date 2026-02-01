import { isFormat } from './formats.util';

describe('formats.util', () => {
  it('validates nchar', () => {
    expect(isFormat.nchar('abc-_.')).toBe(true);
    expect(isFormat.nchar('abc$')).toBe(false);
  });

  it('validates uri', () => {
    expect(isFormat.uri('https://example.com')).toBe(true);
    expect(isFormat.uri('not-a-uri')).toBe(false);
  });

  it('validates vschar', () => {
    expect(isFormat.vschar('abc')).toBe(true);
    expect(isFormat.vschar('\n')).toBe(false);
  });

  it('validates nqschar and nqchar negatives', () => {
    expect(isFormat.nqschar('valid scope')).toBe(true);
    expect(isFormat.nqschar('bad\n')).toBe(false);
    expect(isFormat.nqchar('abc')).toBe(true);
    expect(isFormat.nqchar('é')).toBe(false);
  });

  it('throws when value is not string', () => {
    expect(() => isFormat.nchar(123 as any)).toThrow(TypeError);
  });
});
