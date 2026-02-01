import type {
  AuthorizationCodeModel,
  ClientCredentialsModel,
  PasswordModel,
  RefreshTokenModel,
} from './model.interfaces';

/**
 * Union of OAuth server models used by the module.
 * Useful for DI tokens in consumers (e.g., auth repositories).
 */
export interface AuthRepository extends AuthorizationCodeModel, PasswordModel, ClientCredentialsModel, RefreshTokenModel {}
