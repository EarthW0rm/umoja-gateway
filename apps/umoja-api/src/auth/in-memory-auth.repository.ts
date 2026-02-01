import { randomBytes } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  OAuthClient,
  OAuthToken,
  OAuthUser,
  RefreshToken,
  AuthorizationCode,
  Falsey,
  BasicAuthValidationResult,
  OAuthProduct,
} from '@oauth/oauth';
import type { AuthRepository } from '@oauth/oauth';
import { AUTH_EXPECTED_API_KEY } from './auth.tokens';

type StoredToken = OAuthToken & { refreshTokenExpiresAt?: Date };

/** Client id used for Basic auth validation (must exist in the repository, e.g. demo-client). */
const BASIC_AUTH_CLIENT_ID = 'demo-client';

/**
 * In-memory OAuth model for demo purposes.
 * Supports password, client_credentials and refresh_token grants.
 * Implements validateApiKey and validateBasicAuth so the repository is the single data conduit
 * between OAuth and the consuming application.
 */
@Injectable()
export class InMemoryAuthRepository implements AuthRepository {
  /**
   * In-memory storage for OAuth clients keyed by id.
   */
  private clients = new Map<string, OAuthClient>();
  /**
   * In-memory storage for OAuth users keyed by id or username.
   */
  private users = new Map<string, OAuthUser>();
  /**
   * In-memory storage for access tokens keyed by token string.
   */
  private accessTokens = new Map<string, StoredToken>();
  /**
   * In-memory storage for refresh tokens keyed by token string.
   */
  private refreshTokens = new Map<string, RefreshToken>();
  /**
   * In-memory storage for authorization codes keyed by code string.
   */
  private authorizationCodes = new Map<string, AuthorizationCode>();
  /**
   * In-memory storage for OAuth products keyed by id.
   */
  private products = new Map<string, OAuthProduct>();
  /**
   * Expected API key value for API key validation.
   */
  private readonly expectedApiKey: string;

  /**
   * @param expectedApiKey - Expected value for x-api-key header (injected via AUTH_EXPECTED_API_KEY; defaults to 'changeme').
   */
  constructor(
    @Optional() @Inject(AUTH_EXPECTED_API_KEY) expectedApiKey?: string,
  ) {
    this.expectedApiKey = expectedApiKey ?? 'changeme';
  }

  /**
   * Retrieves a client by id and optional secret.
   * @param clientId - Client identifier.
   * @param clientSecret - Optional secret; when provided, must match the stored secret.
   * @returns The client or null when not found or secret mismatch.
   */
  async getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey> {
    const client = this.clients.get(clientId);
    if (!client) return null;
    if (clientSecret && client.clientSecret !== clientSecret) return null;
    return this.enrichClientWithProduct(client);
  }

  /**
   * Persists an issued token (access and optional refresh) in memory.
   * @param token - Token payload to store.
   * @param client - Associated client.
   * @param user - Associated user.
   * @returns The stored token with client and user attached.
   */
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

  /**
   * Retrieves a stored access token by value.
   * @param accessToken - Raw access token string.
   * @returns The stored token or null.
   */
  async getAccessToken(accessToken: string): Promise<OAuthToken | Falsey> {
    return this.accessTokens.get(accessToken) ?? null;
  }

  /**
   * Checks whether the token has all requested scopes.
   * @param token - OAuth token with scope array.
   * @param scope - Required scope list.
   * @returns True when token.scope includes every scope.
   */
  async verifyScope(token: OAuthToken, scope: string[]): Promise<boolean> {
    if (!token.scope) return false;
    return scope.every((s) => token.scope?.includes(s));
  }

  /**
   * Retrieves a user by username and password for the given client (password grant).
   * @param username - Username.
   * @param password - Plain password.
   * @param client - OAuth client making the request.
   * @returns The user or null when not found or password mismatch.
   */
  async getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser | Falsey> {
    const user = this.users.get(username);
    if (!user) return null;
    if ((user as any).password && (user as any).password !== password) return null;
    return user;
  }

  /**
   * Resolves the user associated with a client (client_credentials grant).
   * @param client - OAuth client with optional userId.
   * @returns The user or null when client has no userId or user not found.
   */
  async getUserFromClient(client: OAuthClient): Promise<OAuthUser | Falsey> {
    if (!client.userId) return null;
    return this.users.get(String(client.userId)) ?? null;
  }

  /**
   * Retrieves a refresh token record by value.
   * @param refreshToken - Raw refresh token string.
   * @returns The refresh token record or null.
   */
  async getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
    return this.refreshTokens.get(refreshToken) ?? null;
  }

  /**
   * Revokes a refresh token (removes it from storage).
   * @param token - Refresh token record.
   * @returns True when the token was found and removed.
   */
  async revokeToken(token: RefreshToken): Promise<boolean> {
    if (token.refreshToken) {
      this.refreshTokens.delete(token.refreshToken);
      return true;
    }
    return false;
  }

  /**
   * Generates a cryptographically random access token string.
   * @returns Hex-encoded random string.
   */
  async generateAccessToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generates a cryptographically random refresh token string.
   * @returns Hex-encoded random string.
   */
  async generateRefreshToken(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generates a cryptographically random authorization code string.
   * @returns Hex-encoded random string.
   */
  async generateAuthorizationCode(): Promise<string> {
    return randomBytes(24).toString('hex');
  }

  /**
   * Retrieves an authorization code record by code value.
   * @param code - Authorization code string.
   * @returns The code record or null.
   */
  async getAuthorizationCode(code: string): Promise<AuthorizationCode | Falsey> {
    return this.authorizationCodes.get(code) ?? null;
  }

  /**
   * Persists an authorization code for the authorization_code flow.
   * @param code - Code value, expiresAt, redirectUri, scope, PKCE fields.
   * @param client - Associated client.
   * @param user - Associated user.
   * @returns The stored authorization code record.
   */
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

  /**
   * Revokes an authorization code after use (one-time use).
   * @param code - Authorization code record.
   * @returns True when the code was found and removed.
   */
  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    if (this.authorizationCodes.has(code.authorizationCode)) {
      this.authorizationCodes.delete(code.authorizationCode);
      return true;
    }
    return false;
  }

  /**
   * Retrieves a product and attaches its clients when available.
   * @param productId - Product identifier.
   * @returns The product with linked clients or null when not found.
   */
  async getProduct(productId: string): Promise<OAuthProduct | Falsey> {
    const product = this.products.get(productId);
    if (!product) return null;
    const clients = await this.getProductClients(productId);
    if (clients && clients.length > 0) {
      return { ...product, clients };
    }
    return product;
  }

  /**
   * Retrieves clients associated with the given product identifier.
   * @param productId - Product identifier.
   * @returns List of clients or null when product does not exist.
   */
  async getProductClients(productId: string): Promise<OAuthClient[] | Falsey> {
    if (!this.products.has(productId)) return null;
    const clients = Array.from(this.clients.values()).filter((client) => {
      const relatedId = client.productId ?? client.product?.id;
      return relatedId === productId;
    });
    return clients.map((client) => this.enrichClientWithProduct(client));
  }

  /**
   * Inserts or updates a client in memory (demo helper, not part of AuthRepository contract).
   * @param client - Full client payload.
   * @returns The same client reference.
   */
  upsertClient(client: OAuthClient): OAuthClient {
    const productId = client.productId ?? client.product?.id;
    const product = productId ? this.products.get(productId) ?? client.product : undefined;
    const sanitizedProduct = product ? sanitizeProduct(product) : undefined;
    const normalizedClient = sanitizedProduct
      ? { ...client, productId: sanitizedProduct.id, product: sanitizedProduct }
      : client;
    if (sanitizedProduct) {
      this.products.set(sanitizedProduct.id, sanitizedProduct);
    }
    this.clients.set(client.id, normalizedClient);
    return normalizedClient;
  }

  /**
   * Inserts or updates a user in memory (demo helper, not part of AuthRepository contract).
   * @param user - Full user payload (may include password for password grant).
   * @returns The same user reference.
   */
  upsertUser(user: OAuthUser & { password?: string }): OAuthUser {
    this.users.set(String(user.id ?? user.username), user);
    return user;
  }

  /**
   * Validates the x-api-key header value (repository as single data conduit).
   * @param apiKey - Value from the request header.
   * @returns True when the key matches the expected value.
   */
  validateApiKey(apiKey: string | undefined): boolean {
    return apiKey === this.expectedApiKey;
  }

  /**
   * Validates username/password (Basic auth) against stored users (repository as single data conduit).
   * @param username - Username from the Basic auth header.
   * @param password - Password from the Basic auth header.
   * @returns The user when valid, or null when invalid.
   */
  async validateBasicAuth(username: string, password: string): Promise<BasicAuthValidationResult | null> {
    const client = await this.getClient(BASIC_AUTH_CLIENT_ID, null);
    if (!client) return null;
    const user = await this.getUser(username, password, client);
    return user ? { user } : null;
  }

  /**
   * Resolves allowed JWT audiences for the client and user (for JWT access token validation).
   * @param client - OAuth client (may have audiences array).
   * @param user - OAuth user (may have audiences array).
   * @returns Combined allowed audiences or default 'umoja-clients'.
   */
  async getAudiences(client: OAuthClient, user: OAuthUser): Promise<string[] | string | null> {
    const fromClient = normalizeAudience((client as any).audiences);
    const fromUser = normalizeAudience((user as any).audiences);
    const combined = Array.from(new Set([...fromClient, ...fromUser]));
    if (combined.length > 0) {
      return combined;
    }
    return ['umoja-clients'];
  }

  /**
   * Inserts or updates a product in memory (demo helper, not part of AuthRepository contract).
   * @param product - Product payload describing the application container.
   * @returns The same product reference without embedded clients.
   */
  upsertProduct(product: OAuthProduct): OAuthProduct {
    const sanitized = sanitizeProduct(product);
    this.products.set(sanitized.id, sanitized);
    return sanitized;
  }

  /**
   * Attaches stored product metadata to a client when available.
   * @param client - Client to enrich.
   * @returns Client with product metadata when present.
   */
  private enrichClientWithProduct(client: OAuthClient): OAuthClient {
    const productId = client.productId ?? client.product?.id;
    if (!productId) {
      return client;
    }
    const storedProduct = this.products.get(productId) ?? client.product;
    if (!storedProduct) {
      return client;
    }
    const sanitized = sanitizeProduct(storedProduct);
    return { ...client, productId: sanitized.id, product: sanitized };
  }
}

/**
 * Removes client lists from products to avoid recursive structures.
 * @param product - Product to sanitize.
 * @returns Product without clients property.
 */
function sanitizeProduct(product: OAuthProduct): OAuthProduct {
  const { clients, ...rest } = product;
  return { ...rest };
}

/**
 * Normalizes audience input to a string array for JWT validation.
 * @param value - Raw audience (string, array, or falsy).
 * @returns Array of audience strings.
 */
function normalizeAudience(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return [value];
  return [];
}
