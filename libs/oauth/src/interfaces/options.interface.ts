import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Algorithm } from 'jsonwebtoken';
import type {
  AuthorizationCodeModel,
  ClientCredentialsModel,
  ExtensionModel,
  PasswordModel,
  RefreshTokenModel,
} from './model.interfaces';
import type { GrantTypeConstructor } from './base.types';
import type { OAuthUser } from './user.interface';

/**
 * Input payload configuring token authentication behavior.
 */
export interface AuthenticateOptions {
  /**
   * Required scopes that must be present on the token.
   */
  scope?: string[];
  /**
   * Whether to add X-Accepted-OAuth-Scopes header.
   */
  addAcceptedScopesHeader?: boolean;
  /**
   * Whether to add X-OAuth-Scopes header for authorized scopes.
   */
  addAuthorizedScopesHeader?: boolean;
  /**
   * Allows tokens to be passed via query string.
   */
  allowBearerTokensInQueryString?: boolean;
}

/**
 * Input payload configuring authorization requests handling.
 */
export interface AuthorizeOptions {
  /**
   * Custom authenticate handler used to resolve the resource owner.
   */
  authenticateHandler?: { handle: (request: FastifyRequest, response: FastifyReply) => Promise<OAuthUser> };
  /**
   * Allows empty state parameter in authorization requests.
   */
  allowEmptyState?: boolean;
  /**
   * Lifetime of authorization codes in seconds.
   */
  authorizationCodeLifetime?: number;
}

/**
 * Input payload configuring token issuance behavior.
 */
export interface TokenOptions {
  /**
   * Lifetime of access tokens in seconds.
   */
  accessTokenLifetime?: number;
  /**
   * Lifetime of refresh tokens in seconds.
   */
  refreshTokenLifetime?: number;
  /**
   * Enables returning additional attributes in token responses.
   */
  allowExtendedTokenAttributes?: boolean;
  /**
   * Per-grant map indicating whether client authentication is required.
   */
  requireClientAuthentication?: Record<string, boolean>;
  /**
   * Determines if a new refresh token is always issued.
   */
  alwaysIssueNewRefreshToken?: boolean;
  /**
   * Custom grant type constructors to extend the server.
   */
  extendedGrantTypes?: Record<string, GrantTypeConstructor>;
  /**
   * JWT signing and verification options.
   */
  jwt?: JwtTokenOptions;
}

/**
  * Input payload configuring JWT signing and verification.
  */
export interface JwtTokenOptions {
  /**
   * JWT signing algorithm.
   */
  algorithm?: Algorithm;
  /**
   * JWT issuer claim to set and validate.
   */
  issuer?: string;
  /**
   * Allowed audiences for JWT validation.
   */
  audience?: string | string[];
  /**
   * Shared secret for symmetric signing.
   */
  secret?: string;
  /**
   * Private key for asymmetric signing.
   */
  privateKey?: string;
  /**
   * Public key for asymmetric verification.
   */
  publicKey?: string;
  /**
   * Key identifier header.
   */
  keyId?: string;
  /**
   * Clock tolerance in seconds for token validation.
   */
  clockToleranceSeconds?: number;
}

/**
 * Input payload aggregating all OAuth server configuration options.
 */
export interface ServerOptions extends AuthenticateOptions, AuthorizeOptions, TokenOptions {
  /**
   * Nested token configuration override when using nested objects.
   */
  token?: TokenOptions;
}
