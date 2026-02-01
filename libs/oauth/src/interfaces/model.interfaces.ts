import type { AuthorizationCode } from './authorization-code.interface';
import type { OAuthClient } from './client.interface';
import type { OAuthProduct } from './product.interface';
import type { OAuthToken } from './token.interface';
import type { OAuthUser } from './user.interface';
import type { RefreshToken } from './refresh-token.interface';
import type { Falsey } from './base.types';
import { BasicAuthValidationResult } from '../guards/validators.interface';

/**
 * Input payload contract for shared OAuth repository operations.
 */
export interface BaseRepository {
  /**
   * Generates an access token string.
   */
  generateAccessToken?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string>;
  /**
   * Retrieves a client by identifier and secret.
   */
  getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey>;
  /**
   * Persists an issued token.
   */
  saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken | Falsey>;
  /**
   * Resolves allowed audiences for JWT access tokens.
   */
  getAudiences?(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string[] | string | Falsey>;
}

/**
 * Input payload contract for product-level repository operations.
 */
export interface ProductRepository {
  /**
   * Retrieves a product container by identifier.
   */
  getProduct(productId: string): Promise<OAuthProduct | Falsey>;
  /**
   * Retrieves OAuth clients that belong to the product.
   */
  getProductClients(productId: string): Promise<OAuthClient[] | Falsey>;
}

/**
 * Input payload contract for authentication-specific repository operations.
 */
export interface RequestAuthenticationRepository {
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
export interface AuthorizationCodeRepository extends BaseRepository, RequestAuthenticationRepository {
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
export interface PasswordRepository extends BaseRepository, RequestAuthenticationRepository {
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
export interface RefreshTokenRepository extends BaseRepository, RequestAuthenticationRepository {
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
export interface ClientCredentialsRepository extends BaseRepository, RequestAuthenticationRepository {
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
export interface ExtensionRepository extends BaseRepository, RequestAuthenticationRepository {}

/**
 * Input payload contract for API key validation.
 */
export interface ApiKeyRepository extends BaseRepository, RequestAuthenticationRepository {
  /**
   * Validates the x-api-key header value (when implemented).
   * Enables the repository to be the single source of truth for API key validation.
   * @param apiKey - Value from the request header.
   * @returns True when the key is valid.
   */
  validateApiKey?(apiKey: string | undefined): boolean;
}

/**
 * Input payload contract for Basic auth validation.
 */
export interface BasicAuthRepository extends BaseRepository, RequestAuthenticationRepository {
  
  /**
   * Validates username/password (e.g. Basic auth) and returns the user when valid (when implemented).
   * Enables the repository to be the single data conduit for Basic auth.
   * @param username - Username from the Basic auth header.
   * @param password - Password from the Basic auth header.
   * @returns The user when valid, or null when invalid.
   */
  validateBasicAuth?(username: string, password: string): Promise<BasicAuthValidationResult | null>;
}
