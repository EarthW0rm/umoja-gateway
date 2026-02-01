import { parse as parseUrl } from 'url';
import { InvalidArgumentException } from '../exceptions';

/**
 * Output model for authorization code response redirection.
 */
export class CodeResponseType {
  /**
   * Authorization code string to attach to the redirect URI.
   */
  code: string;

  /**
   * Creates a response type with the provided authorization code.
   * @param code Input payload representing the authorization code.
   * @throws {InvalidArgumentException} When code is missing.
   */
  constructor(code: string) {
    if (!code) {
      throw new InvalidArgumentException('Missing parameter: `code`');
    }
    this.code = code;
  }

  /**
   * Builds the redirect URI with the authorization code query parameter.
   * @param redirectUri Input payload representing the redirect target.
   * @returns Parsed URL object containing the code.
   * @throws {InvalidArgumentException} When redirectUri is missing.
   */
  buildRedirectUri(redirectUri: string) {
    if (!redirectUri) {
      throw new InvalidArgumentException('Missing parameter: `redirectUri`');
    }

    const uri = parseUrl(redirectUri, true);
    uri.query.code = this.code;
    uri.search = null;
    return uri;
  }
}
