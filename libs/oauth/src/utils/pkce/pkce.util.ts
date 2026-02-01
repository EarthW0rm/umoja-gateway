import { base64URLEncode } from '../string.util';
import { createHash } from '../crypto.util';

const codeChallengeRegexp = /^([a-zA-Z0-9.\-_~]){43,128}$/;

/**
 * Produces the PKCE code challenge value for a verifier.
 * @param method PKCE transformation method (plain or S256).
 * @param verifier PKCE code verifier string.
 * @returns Derived challenge or undefined when invalid.
 */
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

/**
 * Checks if a code challenge string matches PKCE ABNF requirements.
 * @param codeChallenge Input payload to validate.
 * @returns True when the string conforms to allowed characters and length.
 */
export function codeChallengeMatchesABNF(codeChallenge?: string): boolean {
  return typeof codeChallenge === 'string' && !!codeChallenge.match(codeChallengeRegexp);
}

/**
 * Determines whether the request parameters represent a PKCE flow.
 * @param grantType Grant type string from the request.
 * @param codeVerifier PKCE code verifier value.
 * @returns True when authorization_code with a verifier is present.
 */
export function isPKCERequest({
  grantType,
  codeVerifier,
}: {
  grantType?: string;
  codeVerifier?: string;
}): boolean {
  return grantType === 'authorization_code' && !!codeVerifier;
}

/**
 * Validates supported PKCE transformation methods.
 * @param method Method name.
 * @returns True when the method is supported.
 */
export function isValidMethod(method?: string): boolean {
  return method === 'S256' || method === 'plain';
}
