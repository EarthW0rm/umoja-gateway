const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;
const USER_PASS_REGEXP = /^([^:]*):(.*)$/;

type AuthRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

export type BasicAuthCredentials = {
  name: string;
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
