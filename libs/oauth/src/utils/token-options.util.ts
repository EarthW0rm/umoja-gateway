import type { TokenOptions } from '../interfaces';

/**
 * Resolves token-related options, supporting both flat and nested `token` shapes.
 * @param options - Incoming options from module configuration.
 * @returns Token options with nested values merged.
 */
export function resolveTokenOptions(options: TokenOptions & { token?: TokenOptions }): TokenOptions {
  const nested = options.token ?? {};

  return {
    accessTokenLifetime: options.accessTokenLifetime ?? nested.accessTokenLifetime,
    refreshTokenLifetime: options.refreshTokenLifetime ?? nested.refreshTokenLifetime,
    allowExtendedTokenAttributes: options.allowExtendedTokenAttributes ?? nested.allowExtendedTokenAttributes,
    requireClientAuthentication: options.requireClientAuthentication ?? nested.requireClientAuthentication,
    alwaysIssueNewRefreshToken: options.alwaysIssueNewRefreshToken ?? nested.alwaysIssueNewRefreshToken,
    extendedGrantTypes: options.extendedGrantTypes ?? nested.extendedGrantTypes,
    jwt: options.jwt ?? nested.jwt,
  };
}
