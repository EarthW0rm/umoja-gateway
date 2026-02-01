import { InvalidArgumentException } from '../exceptions';

export class BearerTokenType {
  accessToken: string;
  accessTokenLifetime?: number;
  refreshToken?: string;
  scope?: string[];
  customAttributes?: Record<string, unknown>;

  constructor(
    accessToken: string,
    accessTokenLifetime?: number,
    refreshToken?: string,
    scope?: string[],
    customAttributes?: Record<string, unknown>,
  ) {
    if (!accessToken) {
      throw new InvalidArgumentException('Missing parameter: `accessToken`');
    }

    this.accessToken = accessToken;
    this.accessTokenLifetime = accessTokenLifetime;
    this.refreshToken = refreshToken;
    this.scope = scope;

    if (customAttributes) {
      this.customAttributes = customAttributes;
    }
  }

  valueOf(): Record<string, unknown> {
    const object: Record<string, unknown> = {
      access_token: this.accessToken,
      token_type: 'Bearer',
    };

    if (this.accessTokenLifetime) {
      object.expires_in = this.accessTokenLifetime;
    }

    if (this.refreshToken) {
      object.refresh_token = this.refreshToken;
    }

    if (this.scope) {
      object.scope = this.scope;
    }

    const customAttributes = this.customAttributes;
    if (customAttributes) {
      Object.keys(customAttributes).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(customAttributes, key)) {
          object[key] = customAttributes[key];
        }
      });
    }

    return object;
  }
}
