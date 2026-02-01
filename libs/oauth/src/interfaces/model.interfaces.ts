import type { AuthorizationCode } from './authorization-code.interface';
import type { OAuthClient } from './client.interface';
import type { OAuthToken } from './token.interface';
import type { OAuthUser } from './user.interface';
import type { RefreshToken } from './refresh-token.interface';
import type { Falsey } from './base.types';

/**
 * Input payload contract for shared OAuth model operations.
 */
export interface BaseModel {
  /**
   * Generates an access token string.
   */
  generateAccessToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Retrieves a client by identifier and secret.
   */
  getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey>;
  /**
   * Persists an issued token model.
   */
  saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken | Falsey>;
  /**
   * Resolves allowed audiences for JWT access tokens.
   */
  getAudiences?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string[] | string | Falsey>;
}

/**
 * Input payload contract for authentication-specific model operations.
 */
export interface RequestAuthenticationModel {
  /**
   * Retrieves an access token by its value.
   */
  getAccessToken(accessToken: string): Promise<OAuthToken | Falsey>;
  /**
   * Validates whether the token includes the requested scope.
   */
  verifyScope?(token: OAuthToken, scope: string[]): Promise<boolean>;
}

/**
 * Input payload contract for authorization code grant storage.
 */
export interface AuthorizationCodeModel extends BaseModel, RequestAuthenticationModel {
  /**
   * Generates a refresh token string.
   */
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Generates an authorization code string.
   */
  generateAuthorizationCode?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Retrieves an authorization code record.
   */
  getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCode | Falsey>;
  /**
   * Persists an authorization code record.
   */
  saveAuthorizationCode(
    code: Pick<
      AuthorizationCode,
      'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'
    >,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode | Falsey>;
  /**
   * Revokes an authorization code after use.
   */
  revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean>;
  /**
   * Validates the scope for the authorization code flow.
   */
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
  /**
   * Validates a redirect URI for the client.
   */
  validateRedirectUri?(redirectUri: string, client: OAuthClient): Promise<boolean>;
}

/**
 * Input payload contract for password grant storage.
 */
export interface PasswordModel extends BaseModel, RequestAuthenticationModel {
  /**
   * Generates a refresh token string.
   */
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Retrieves a user by username and password.
   */
  getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser | Falsey>;
  /**
   * Validates scope for the password grant flow.
   */
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
}

/**
 * Input payload contract for refresh token grant storage.
 */
export interface RefreshTokenModel extends BaseModel, RequestAuthenticationModel {
  /**
   * Generates a refresh token string.
   */
  generateRefreshToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Retrieves a refresh token record.
   */
  getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey>;
  /**
   * Revokes a refresh token record.
   */
  revokeToken(token: RefreshToken): Promise<boolean>;
}

/**
 * Input payload contract for client credentials grant storage.
 */
export interface ClientCredentialsModel extends BaseModel, RequestAuthenticationModel {
  /**
   * Resolves the user associated with the client credentials.
   */
  getUserFromClient(client: OAuthClient): Promise<OAuthUser | Falsey>;
  /**
   * Validates scope for the client credentials flow.
   */
  validateScope?(user: OAuthUser, client: OAuthClient, scope?: string[]): Promise<string[] | Falsey>;
}

/**
 * Input payload contract for custom extension grant storage.
 */
export interface ExtensionModel extends BaseModel, RequestAuthenticationModel {}
