import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { OAuthClient, OAuthToken, OAuthUser, RefreshToken, AuthorizationCode, Falsey } from '@oauth/oauth';
import type { AuthRepository } from '@oauth/oauth';

type StoredToken = OAuthToken & { refreshTokenExpiresAt?: Date };

/**
 * In-memory OAuth model for demo purposes.
 * Supports password, client_credentials and refresh_token grants.
 */
@Injectable()
export class InMemoryAuthRepository implements AuthRepository {
  private clients = new Map<string, OAuthClient>();
  private users = new Map<string, OAuthUser>();
  private accessTokens = new Map<string, StoredToken>();
  private refreshTokens = new Map<string, RefreshToken>();
  private authorizationCodes = new Map<string, AuthorizationCode>();

  constructor() {}

  async getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey> {
    const client = this.clients.get(clientId);
    if (!client) return null;
    if (clientSecret && client.clientSecret !== clientSecret) return null;
    return client;
  }

  async saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken> {
    const stored: StoredToken = { ...token, client, user };
    if (token.accessToken) {
      this.accessTokens.set(token.accessToken, stored);
    }
    if (token.refreshToken) {
      this.refreshTokens.set(token.refreshToken, {
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        client,
        user,
        scope: token.scope,
      });
    }
    return stored;
  }

  async getAccessToken(accessToken: string): Promise<OAuthToken | Falsey> {
    return this.accessTokens.get(accessToken) ?? null;
  }

  async verifyScope(token: OAuthToken, scope: string[]): Promise<boolean> {
    if (!token.scope) return false;
    return scope.every((s) => token.scope?.includes(s));
  }

  async getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser | Falsey> {
    const user = this.users.get(username);
    if (!user) return null;
    if ((user as any).password && (user as any).password !== password) return null;
    return user;
  }

  async getUserFromClient(client: OAuthClient): Promise<OAuthUser | Falsey> {
    if (!client.userId) return null;
    return this.users.get(String(client.userId)) ?? null;
  }

  async getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
    return this.refreshTokens.get(refreshToken) ?? null;
  }

  async revokeToken(token: RefreshToken): Promise<boolean> {
    if (token.refreshToken) {
      this.refreshTokens.delete(token.refreshToken);
      return true;
    }
    return false;
  }

  async generateAccessToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  async generateRefreshToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  async generateAuthorizationCode(): Promise<string> {
    return randomBytes(24).toString('hex');
  }

  async getAuthorizationCode(code: string): Promise<AuthorizationCode | Falsey> {
    return this.authorizationCodes.get(code) ?? null;
  }

  async saveAuthorizationCode(
    code: Pick<
      AuthorizationCode,
      'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'
    >,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode> {
    const entry: AuthorizationCode = {
      ...code,
      client,
      user,
    };
    this.authorizationCodes.set(entry.authorizationCode, entry);
    return entry;
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    if (this.authorizationCodes.has(code.authorizationCode)) {
      this.authorizationCodes.delete(code.authorizationCode);
      return true;
    }
    return false;
  }

  upsertClient(client: OAuthClient) {
    this.clients.set(client.id, client);
    return client;
  }

  upsertUser(user: OAuthUser & { password?: string }) {
    this.users.set(String(user.id ?? user.username), user);
    return user;
  }

  async getAudiences(client: OAuthClient, user: OAuthUser): Promise<string[] | string | null> {
    const fromClient = normalizeAudience((client as any).audiences);
    const fromUser = normalizeAudience((user as any).audiences);
    const combined = Array.from(new Set([...fromClient, ...fromUser]));
    if (combined.length > 0) {
      return combined;
    }
    return ['umoja-clients'];
  }
}

function normalizeAudience(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return [value];
  return [];
}
