import { parse as parseUrl } from 'url';
import { InvalidArgumentException } from '../exceptions';

export class CodeResponseType {
  code: string;

  constructor(code: string) {
    if (!code) {
      throw new InvalidArgumentException('Missing parameter: `code`');
    }
    this.code = code;
  }

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
