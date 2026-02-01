/**
 * Utility union type representing falsy values in JavaScript.
 */
export type Falsey = '' | 0 | false | null | undefined;

import type { OAuthToken } from './token.interface';

/**
 * Constructor signature for custom grant type implementations.
 */
export type GrantTypeConstructor = new (options: Record<string, unknown>) => {
  handle: (request: unknown, client: unknown) => Promise<OAuthToken>;
};
