import type { OAuthClient } from './client.interface';
import type { OAuthUser } from './user.interface';

export interface OAuthToken {
  accessToken: string;
  accessTokenExpiresAt?: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  scope?: string[];
  client: OAuthClient;
  user: OAuthUser;
  [key: string]: unknown;
}
