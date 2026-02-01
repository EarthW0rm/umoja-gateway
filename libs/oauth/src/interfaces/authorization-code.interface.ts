import type { OAuthClient } from './client.interface';
import type { OAuthUser } from './user.interface';

export interface AuthorizationCode {
  authorizationCode: string;
  expiresAt: Date;
  redirectUri: string;
  scope?: string[];
  client: OAuthClient;
  user: OAuthUser;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  [key: string]: unknown;
}
