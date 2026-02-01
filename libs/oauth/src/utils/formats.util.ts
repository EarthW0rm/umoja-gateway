/* eslint-disable no-control-regex */

const rules = {
  NCHAR: /^[\u002D\u002E\u005F\w]+$/,
  NQCHAR: /^[\u0021\u0023-\u005B\u005D-\u007E]+$/,
  NQSCHAR: /^[\u0020-\u0021\u0023-\u005B\u005D-\u007E]+$/,
  UNICODECHARNOCRLF: /^[\u0009\u0020-\u007E\u0080-\uD7FF\uE000-\uFFFD]+$/,
  UNICODECHARNOCRLF_EXTENDED: /^[\u{10000}-\u{10FFFF}]+$/u,
  URI: /^[a-zA-Z][a-zA-Z0-9+.-]+:/,
  VSCHAR: /^[\u0020-\u007E]+$/,
};

/* eslint-enable no-control-regex */

const assertString = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new TypeError('Value must be a string');
  }
};

export const isFormat = {
  nchar(value: string) {
    assertString(value);
    return rules.NCHAR.test(value);
  },

  nqchar(value: string) {
    assertString(value);
    return rules.NQCHAR.test(value);
  },

  nqschar(value: string) {
    assertString(value);
    return rules.NQSCHAR.test(value);
  },

  uchar(value: string) {
    assertString(value);
    if (rules.UNICODECHARNOCRLF.test(value)) {
      return true;
    }

    return rules.UNICODECHARNOCRLF_EXTENDED.test(value);
  },

  uri(value: string) {
    assertString(value);
    return rules.URI.test(value);
  },

  vschar(value: string) {
    assertString(value);
    return rules.VSCHAR.test(value);
  },
};
