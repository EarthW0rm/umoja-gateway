import { InvalidArgumentException } from '../exceptions';

/**
 * Output model for serializing bearer token responses.
 */
export class BearerTokenType {
  /**
   * Access token string to return.
   */
  accessToken: string;
  /**
   * Lifetime of the access token in seconds.
   */
  accessTokenLifetime?: number;
  /**
   * Refresh token string when issued.
   */
  refreshToken?: string;
  /**
   * Authorized scopes.
   */
  scope?: string[];
  /**
   * Extra attributes to be appended to the response.
   */
  customAttributes?: Record<string, unknown>;

  /**
   * Creates a bearer token type instance.
   * @param accessToken Input payload representing the access token.
   * @param accessTokenLifetime Lifetime in seconds.
   * @param refreshToken Optional refresh token string.
   * @param scope Optional scope array.
   * @param customAttributes Optional extra attributes to return.
   * @throws {InvalidArgumentException} When accessToken is missing.
   */
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

  /**
   * Serializes the token payload following OAuth bearer token response format.
   * @returns Plain object ready to send in HTTP response.
   */
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
