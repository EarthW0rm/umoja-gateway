import { ServerException } from '../exceptions';
import type {
  AuthorizationCode,
  OAuthClient,
  OAuthToken,
  OAuthUser,
  RefreshToken,
} from '../interfaces';

/**
 * Base repository with convenience factory to adapt user implementations.
 * Override required methods for the grant types you support.
 */
export abstract class Repository {

  abstract getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient>;

  abstract saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken>;

  abstract getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser>;

  abstract getUserFromClient(client: OAuthClient): Promise<OAuthUser>;

  abstract getAccessToken(accessToken: string): Promise<OAuthToken>;

  abstract getRefreshToken(refreshToken: string): Promise<RefreshToken>;

  abstract getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCode>;

  abstract saveAuthorizationCode(
    code: AuthorizationCode,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode>;

  abstract revokeToken(token: RefreshToken): Promise<boolean>;

  abstract revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean>;

  abstract verifyScope(accessToken: OAuthToken, scope: string[]): Promise<boolean>;

  abstract generateAccessToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;

  abstract generateRefreshToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;

  abstract generateAuthorizationCode(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;

  abstract validateScope(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | false>;

  abstract validateRedirectUri(redirectUri: string, client: OAuthClient): Promise<boolean>;
}
