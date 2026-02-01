/**
 * Utility union type representing falsy values in JavaScript.
 */
export type Falsey = '' | 0 | false | null | undefined;

import type { OAuthToken } from './token.interface';

/**
 * Constructor signature for custom grant type implementations.
 * @param options - Input payload with accessTokenLifetime, authRepository, etc.
 * @returns Instance with handle(request, client) returning the issued OAuth token.
 */
export type GrantTypeConstructor = new (options: Record<string, unknown>) => {
  /** Processes the token request for the given client. */
  handle: (request: unknown, client: unknown) => Promise<OAuthToken>;
};
