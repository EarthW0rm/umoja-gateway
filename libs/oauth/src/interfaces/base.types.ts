export type Falsey = '' | 0 | false | null | undefined;

import type { OAuthToken } from './token.interface';

export type GrantTypeConstructor = new (options: Record<string, unknown>) => {
  handle: (request: unknown, client: unknown) => Promise<OAuthToken>;
};
