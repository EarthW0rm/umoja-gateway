import { ServerException } from '../exceptions';
import type {
  AuthorizationCode,
  OAuthClient,
  OAuthToken,
  OAuthUser,
  RefreshToken,
} from '../interfaces';

/**
 * Base model with convenience factory to adapt user implementations.
 * Override required methods for the grant types you support.
 */
export class Model {
  static from<T extends Model>(impl: Partial<T>): T {
    const instance = new Model() as T;
    const nullFns: Record<string, unknown> = {};

    Object.getOwnPropertyNames(Model.prototype).forEach((key) => {
      nullFns[key] = null;
    });

    Object.assign(instance, nullFns, impl);
    return instance;
  }

  async getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient> {
    throw new ServerException('getClient not implemented');
  }

  async saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken> {
    throw new ServerException('saveToken not implemented');
  }

  async getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser> {
    throw new ServerException('getUser not implemented');
  }

  async getUserFromClient(client: OAuthClient): Promise<OAuthUser> {
    throw new ServerException('getUserFromClient not implemented');
  }

  async getAccessToken(accessToken: string): Promise<OAuthToken> {
    throw new ServerException('getAccessToken not implemented');
  }

  async getRefreshToken(refreshToken: string): Promise<RefreshToken> {
    throw new ServerException('getRefreshToken not implemented');
  }

  async getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCode> {
    throw new ServerException('getAuthorizationCode not implemented');
  }

  async saveAuthorizationCode(
    code: AuthorizationCode,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode> {
    throw new ServerException('saveAuthorizationCode not implemented');
  }

  async revokeToken(token: RefreshToken): Promise<boolean> {
    throw new ServerException('revokeToken not implemented');
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    throw new ServerException('revokeAuthorizationCode not implemented');
  }

  async verifyScope(accessToken: OAuthToken, scope: string[]): Promise<boolean> {
    throw new ServerException('verifyScope not implemented');
  }

  async generateAccessToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    throw new ServerException('generateAccessToken not implemented');
  }

  async generateRefreshToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    throw new ServerException('generateRefreshToken not implemented');
  }

  async generateAuthorizationCode(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    throw new ServerException('generateAuthorizationCode not implemented');
  }

  async validateScope(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | false> {
    throw new ServerException('validateScope not implemented');
  }

  async validateRedirectUri(redirectUri: string, client: OAuthClient): Promise<boolean> {
    throw new ServerException('validateRedirectUri not implemented');
  }
}
