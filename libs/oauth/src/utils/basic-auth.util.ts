const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;
const USER_PASS_REGEXP = /^([^:]*):(.*)$/;

type AuthRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Output model representing parsed Basic authentication credentials.
 */
export type BasicAuthCredentials = {
  /**
   * Username extracted from the header.
   */
  name: string;
  /**
   * Password extracted from the header.
   */
  pass: string;
};

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString();
}

function getAuthorization(request: AuthRequest): string | undefined {
  if (!request.headers || typeof request.headers !== 'object') {
    throw new TypeError('argument req is required to have headers property');
  }

  const header = request.headers.authorization;
  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}

/**
 * Parses a Basic authorization header into credentials.
 * @param value Input payload representing the Authorization header value.
 * @returns Parsed credentials or undefined when missing/invalid.
 */
export function parseBasicAuthHeader(value: string | undefined): BasicAuthCredentials | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = CREDENTIALS_REGEXP.exec(value);
  if (!match) {
    return undefined;
  }

  const userPass = USER_PASS_REGEXP.exec(decodeBase64(match[1]));
  if (!userPass) {
    return undefined;
  }

  return { name: userPass[1], pass: userPass[2] };
}

/**
 * Parses Basic authentication credentials from a request object.
 * @param request Input payload containing headers.
 * @returns Parsed credentials or undefined when not present.
 * @throws {TypeError} When request structure is invalid.
 */
export function parseBasicAuth(request: AuthRequest): BasicAuthCredentials | undefined {
  if (!request) {
    throw new TypeError('argument req is required');
  }

  if (typeof request !== 'object') {
    throw new TypeError('argument req is required to be an object');
  }

  const header = getAuthorization(request);
  return parseBasicAuthHeader(header);
}
