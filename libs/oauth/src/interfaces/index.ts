/**
 * OAuth interfaces: clients, users, tokens, repositories, and server options.
 */
export type { Falsey, GrantTypeConstructor } from './base.types';
export type { OAuthUser } from './user.interface';
export type { OAuthClient } from './client.interface';
export type { OAuthProduct } from './product.interface';
export type { AuthorizationCode } from './authorization-code.interface';
export type { OAuthToken } from './token.interface';
export type { RefreshToken } from './refresh-token.interface';
export type {
  BaseRepository,
  RequestAuthenticationRepository,
  AuthorizationCodeRepository,
  PasswordRepository,
  RefreshTokenRepository,
  ClientCredentialsRepository,
  ExtensionRepository,
  ProductRepository,
} from './model.interfaces';
export type {
  AuthenticateOptions,
  AuthorizeOptions,
  TokenOptions,
  ServerOptions,
  JwtTokenOptions,
} from './options.interface';
