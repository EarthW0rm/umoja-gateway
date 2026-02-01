import type { AuthorizationCode } from './authorization-code.interface';
import type { OAuthClient } from './client.interface';
import type { OAuthToken } from './token.interface';
import type { OAuthUser } from './user.interface';
import type { RefreshToken } from './refresh-token.interface';
import type { Falsey } from './base.types';

export interface BaseModel {
  generateAccessToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey>;
  saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken | Falsey>;
  getAudiences?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string[] | string | Falsey>;
}

export interface RequestAuthenticationModel {
  getAccessToken(accessToken: string): Promise<OAuthToken | Falsey>;
  verifyScope?(token: OAuthToken, scope: string[]): Promise<boolean>;
}

export interface AuthorizationCodeModel extends BaseModel, RequestAuthenticationModel {
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  generateAuthorizationCode?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCode | Falsey>;
  saveAuthorizationCode(
    code: Pick<
      AuthorizationCode,
      'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'
    >,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode | Falsey>;
  revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean>;
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
  validateRedirectUri?(redirectUri: string, client: OAuthClient): Promise<boolean>;
}

export interface PasswordModel extends BaseModel, RequestAuthenticationModel {
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser | Falsey>;
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
}

export interface RefreshTokenModel extends BaseModel, RequestAuthenticationModel {
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey>;
  revokeToken(token: RefreshToken): Promise<boolean>;
}

export interface ClientCredentialsModel extends BaseModel, RequestAuthenticationModel {
  getUserFromClient(client: OAuthClient): Promise<OAuthUser | Falsey>;
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
}

export interface ExtensionModel extends BaseModel, RequestAuthenticationModel {}
