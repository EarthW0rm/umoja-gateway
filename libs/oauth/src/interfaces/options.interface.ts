import type {
  AuthorizationCodeModel,
  ClientCredentialsModel,
  ExtensionModel,
  PasswordModel,
  RefreshTokenModel,
} from './model.interfaces';
import type { GrantTypeConstructor } from './base.types';
import type { OAuthUser } from './user.interface';
import type { FastifyReply, FastifyRequest } from 'fastify';

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
}

export interface ServerOptions extends AuthenticateOptions, AuthorizeOptions, TokenOptions {
  model:
    | AuthorizationCodeModel
    | ClientCredentialsModel
    | RefreshTokenModel
    | PasswordModel
    | ExtensionModel;
}
