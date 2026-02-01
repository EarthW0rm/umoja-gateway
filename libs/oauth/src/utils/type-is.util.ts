type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

const TYPE_REGEXP = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;

const MIME_LOOKUP: Record<string, string> = {
  json: 'application/json',
  html: 'text/html',
  text: 'text/plain',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
};

/**
 * Matches a content-type header value against expected media types.
 * @param value Input payload representing the content-type header.
 * @param types Expected media types or wildcards.
 * @returns Matched type or false when none match.
 */
export function typeIs(value: string | undefined, types?: string[] | string): string | false {
  const val = tryNormalizeType(value);
  if (!val) {
    return false;
  }

  if (!types || (Array.isArray(types) && types.length === 0)) {
    return val;
  }

  const normalizedTypes = Array.isArray(types) ? types : [types];

  for (const type of normalizedTypes) {
    const normalized = normalize(type);
    if (mimeMatch(normalized, val)) {
      return type[0] === '+' || type.includes('*') ? val : type;
    }
  }

  return false;
}

/**
 * Evaluates a request object to determine if its content-type matches provided types.
 * @param request Input payload containing headers.
 * @param types Expected media types or wildcards.
 * @returns Matched type, false when mismatch, or null when body absent.
 */
export function requestType(request: RequestLike, types?: string[] | string): string | false | null {
  if (!hasBody(request)) {
    return null;
  }

  const value = getHeaderValue(request, 'content-type');
  return typeIs(value, types);
}

/**
 * Checks whether a request likely contains a body by inspecting headers.
 * @param request Input payload containing headers.
 * @returns True when content-length or transfer-encoding is present.
 */
export function hasBody(request: RequestLike): boolean {
  const transferEncoding = getHeaderValue(request, 'transfer-encoding');
  const contentLength = getHeaderValue(request, 'content-length');
  return typeof transferEncoding !== 'undefined' || !Number.isNaN(Number(contentLength));
}

/**
 * Normalizes media type aliases and wildcards to full MIME strings.
 * @param type Input payload representing a media type.
 * @returns Normalized MIME string, false when invalid, or null for unsupported values.
 */
export function normalize(type: string): string | false | null {
  if (typeof type !== 'string') {
    return false;
  }

  switch (type) {
    case 'urlencoded':
      return 'application/x-www-form-urlencoded';
    case 'multipart':
      return 'multipart/*';
    default:
      break;
  }

  if (type[0] === '+') {
    return `*/*${type}`;
  }

  return type.includes('/') ? type : MIME_LOOKUP[type] ?? false;
}

/**
 * Compares an expected MIME pattern against an actual MIME type.
 * @param expected Expected MIME with optional wildcards.
 * @param actual Actual normalized MIME string.
 * @returns True when the actual type matches the expected pattern.
 */
export function mimeMatch(expected: string | false | null, actual: string): boolean {
  if (!expected) {
    return false;
  }

  const actualParts = actual.split('/');
  const expectedParts = expected.split('/');

  if (actualParts.length !== 2 || expectedParts.length !== 2) {
    return false;
  }

  if (expectedParts[0] !== '*' && expectedParts[0] !== actualParts[0]) {
    return false;
  }

  if (expectedParts[1].startsWith('*+')) {
    return (
      expectedParts[1].length <= actualParts[1].length + 1 &&
      expectedParts[1].slice(1) === actualParts[1].slice(1 - expectedParts[1].length)
    );
  }

  if (expectedParts[1] !== '*' && expectedParts[1] !== actualParts[1]) {
    return false;
  }

  return true;
}

function normalizeType(value: string): string | null {
  const type = value.split(';')[0]?.trim();
  if (!type) {
    return null;
  }

  return TYPE_REGEXP.test(type) ? type.toLowerCase() : null;
}

function tryNormalizeType(value?: string): string | null {
  try {
    return value ? normalizeType(value) : null;
  } catch {
    return null;
  }
}

function getHeaderValue(request: RequestLike, header: string): string | undefined {
  const headers = request.headers ?? {};
  const value = headers[header];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
