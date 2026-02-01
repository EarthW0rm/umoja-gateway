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

export interface AuthenticateOptions {
  scope?: string[];
  addAcceptedScopesHeader?: boolean;
  addAuthorizedScopesHeader?: boolean;
  allowBearerTokensInQueryString?: boolean;
}

export interface AuthorizeOptions {
  authenticateHandler?: { handle: (request: FastifyRequest, response: FastifyReply) => Promise<OAuthUser> };
  allowEmptyState?: boolean;
  authorizationCodeLifetime?: number;
}

export interface TokenOptions {
  accessTokenLifetime?: number;
  refreshTokenLifetime?: number;
  allowExtendedTokenAttributes?: boolean;
  requireClientAuthentication?: Record<string, boolean>;
  alwaysIssueNewRefreshToken?: boolean;
  extendedGrantTypes?: Record<string, GrantTypeConstructor>;
  jwt?: JwtTokenOptions;
}

export interface JwtTokenOptions {
  algorithm?: Algorithm;
  issuer?: string;
  audience?: string | string[];
  secret?: string;
  privateKey?: string;
  publicKey?: string;
  keyId?: string;
  clockToleranceSeconds?: number;
}

export interface ServerOptions extends AuthenticateOptions, AuthorizeOptions, TokenOptions {
  token?: TokenOptions;
}
