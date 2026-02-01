import { base64URLEncode } from '../string.util';
import { createHash } from '../crypto.util';

const codeChallengeRegexp = /^([a-zA-Z0-9.\-_~]){43,128}$/;

export function getHashForCodeChallenge({
  method,
  verifier,
}: {
  method?: string;
  verifier?: string;
}): string | undefined {
  if (isValidMethod(method) && typeof verifier === 'string' && verifier.length > 0) {
    if (method === 'plain') {
      return verifier;
    }

    if (method === 'S256') {
      const hash = createHash({ data: verifier });
      return base64URLEncode(hash as Buffer);
    }
  }

  return undefined;
}

export function codeChallengeMatchesABNF(codeChallenge?: string): boolean {
  return typeof codeChallenge === 'string' && !!codeChallenge.match(codeChallengeRegexp);
}

export function isPKCERequest({
  grantType,
  codeVerifier,
}: {
  grantType?: string;
  codeVerifier?: string;
}): boolean {
  return grantType === 'authorization_code' && !!codeVerifier;
}

export function isValidMethod(method?: string): boolean {
  return method === 'S256' || method === 'plain';
}
