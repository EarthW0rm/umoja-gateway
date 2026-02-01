import type {
  ApiKeyRepository,
  AuthorizationCodeRepository,
  BasicAuthRepository,
  ClientCredentialsRepository,
  PasswordRepository,
  ProductRepository,
  RefreshTokenRepository,
} from './model.interfaces';
import type { BasicAuthValidationResult } from '../guards';

export type { BasicAuthValidationResult };

/**
 * Union of OAuth server repositories used by the module.
 * Useful for DI tokens in consumers (e.g., auth repositories).
 * Optional validateApiKey and validateBasicAuth allow the repository to act as the single
 * data conduit for both OAuth and app-level API key / Basic auth validation.
 */
export interface AuthRepository
  extends AuthorizationCodeRepository,
  PasswordRepository,
  ClientCredentialsRepository,
  RefreshTokenRepository,
  BasicAuthRepository,
  ProductRepository,
  ApiKeyRepository { }