import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type {
  AuthRepository,
  AuthorizationCode,
  BasicAuthValidationResult,
  Falsey,
  OAuthClient,
  OAuthProduct,
  OAuthToken,
  OAuthUser,
  RefreshToken,
} from '@oauth/oauth';
import {
  CONTROL_PLANE_HTTP_TIMEOUT,
  CONTROL_PLANE_STRAPI_API_TOKEN,
  CONTROL_PLANE_STRAPI_BASE_URL,
} from '../../control-plane.tokens';

type RelationSingle<T> =
  | { data: StrapiEntity<T> | null }
  | StrapiEntity<T>
  | null
  | undefined;
type RelationMany<T> = { data: StrapiEntity<T>[] } | StrapiEntity<T>[] | null | undefined;

/**
 * Strapi document shape: v4 uses id + attributes; v5 uses documentId with optional attributes.
 * We support both for compatibility.
 */
interface StrapiEntity<T> {
  id?: number;
  documentId?: string;
  attributes?: T;
  /** v5 flat: attributes may be at root level */
  [key: string]: unknown;
}

interface StrapiError {
  message?: string;
  status?: number;
  name?: string;
  details?: unknown;
}

interface StrapiCollectionResponse<T> {
  data: StrapiEntity<T>[];
  meta?: unknown;
  error?: StrapiError;
}

interface StrapiSingleResponse<T> {
  data: StrapiEntity<T> | null;
  meta?: unknown;
  error?: StrapiError;
}

interface StrapiAudienceAttributes {
  value: string;
  description?: string;
}

interface StrapiOAuthProductAttributes {
  name: string;
  description?: string;
  logoUri?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  owners?: string[] | null;
  clients?: RelationMany<StrapiOAuthClientAttributes>;
}

interface StrapiOAuthUserAttributes {
  username: string;
  password: string;
  audiences?: RelationMany<StrapiAudienceAttributes>;
}

interface StrapiOAuthClientAttributes {
  redirectUris: string[] | string;
  clientSecret: string;
  grants: string[] | string;
  accessTokenLifetime: number;
  refreshTokenLifetime: number;
  product?: RelationSingle<StrapiOAuthProductAttributes>;
  user?: RelationSingle<StrapiOAuthUserAttributes>;
  audiences?: RelationMany<StrapiAudienceAttributes>;
}

interface StrapiOAuthTokenAttributes {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
  scope?: string[] | string | null;
  client?: RelationSingle<StrapiOAuthClientAttributes>;
  user?: RelationSingle<StrapiOAuthUserAttributes>;
}

interface StrapiRefreshTokenAttributes {
  refreshToken: string;
  refreshTokenExpiresAt: string;
  scope?: string[] | string | null;
  client?: RelationSingle<StrapiOAuthClientAttributes>;
  user?: RelationSingle<StrapiOAuthUserAttributes>;
}

interface StrapiAuthorizationCodeAttributes {
  authorizationCode: string;
  expiresAt: string;
  redirectUri: string;
  scope?: string[] | string | null;
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
  client?: RelationSingle<StrapiOAuthClientAttributes>;
  user?: RelationSingle<StrapiOAuthUserAttributes>;
}

interface StrapiApiKeyAttributes {
  apiKey: string;
  description?: string;
  client?: RelationSingle<StrapiOAuthClientAttributes>;
}

/**
 * Auth repository backed by the Strapi control plane.
 * Performs CRUD operations against Strapi collections using the provided API token.
 */
@Injectable()
export class StrapiOAuthRepository implements AuthRepository {
  private readonly logger = new Logger(StrapiOAuthRepository.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private apiKeysCache = new Set<string>();
  private apiKeyCacheReady = false;
  private apiKeyCacheLoading = false;

  /**
   * @param baseUrl - Strapi base URL (without the /api suffix).
   * @param apiToken - Strapi API token used for bearer authentication.
   * @param timeoutMs - Request timeout in milliseconds.
   */
  constructor(
    @Inject(CONTROL_PLANE_STRAPI_BASE_URL) baseUrl: string,
    @Inject(CONTROL_PLANE_STRAPI_API_TOKEN) private readonly apiToken: string,
    @Inject(CONTROL_PLANE_HTTP_TIMEOUT) timeoutMs: number,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    void this.refreshApiKeyCache();
  }

  async getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey> {
    const populateQuery = {
      'populate[0]': 'product',
      'populate[1]': 'user',
      'populate[2]': 'audiences',
    };
    try {
      const path = `oauth-clients/${encodeURIComponent(clientId)}`;
      const response = await this.request<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
        path,
        undefined,
        populateQuery,
      );
      this.ensureNoError(response);
      if (!response.data) {
        return null;
      }
      const client = this.mapClient(response.data);
      if (clientSecret && client.clientSecret !== clientSecret) {
        return null;
      }
      return client;
    } catch {
      const byNumericId = await this.tryGetClientByNumericId(clientId, populateQuery, clientSecret);
      if (byNumericId) return byNumericId;
      if (clientSecret == null || clientSecret === '') {
        return null;
      }
      const listResponse = await this.request<StrapiCollectionResponse<StrapiOAuthClientAttributes>>(
        'oauth-clients',
        undefined,
        { 'filters[clientSecret][$eq]': clientSecret, ...populateQuery },
      );
      this.ensureNoError(listResponse);
      const entity = this.pickFirst(listResponse);
      if (!entity) {
        return null;
      }
      if (!this.clientIdMatchesEntity(entity, clientId)) {
        return null;
      }
      const client = this.mapClient(entity);
      return client.clientSecret === clientSecret ? client : null;
    }
  }

  private clientIdMatchesEntity(entity: StrapiEntity<StrapiOAuthClientAttributes>, clientId: string): boolean {
    if (this.getDocId(entity) === clientId) return true;
    const numId = entity.id ?? (entity as Record<string, unknown>).id;
    return numId != null && String(numId) === clientId;
  }

  private async tryGetClientByNumericId(
    clientId: string,
    populateQuery: Record<string, string>,
    clientSecret: string | null,
  ): Promise<OAuthClient | null> {
    const numericId = Number(clientId);
    if (Number.isNaN(numericId) || numericId < 1) return null;
    try {
      const listResponse = await this.request<StrapiCollectionResponse<StrapiOAuthClientAttributes>>(
        'oauth-clients',
        undefined,
        { 'filters[id][$eq]': numericId, ...populateQuery },
      );
      this.ensureNoError(listResponse);
      const entity = this.pickFirst(listResponse);
      if (!entity) return null;
      const client = this.mapClient(entity);
      if (clientSecret != null && clientSecret !== '' && client.clientSecret !== clientSecret) {
        return null;
      }
      return client;
    } catch {
      return null;
    }
  }

  async saveToken(token: OAuthToken, client: OAuthClient, user: OAuthUser): Promise<OAuthToken> {
    const accessTokenExpiresAt = token.accessTokenExpiresAt ?? new Date();
    const refreshTokenExpiresAt = token.refreshTokenExpiresAt ?? token.accessTokenExpiresAt ?? new Date();

    const clientRel = this.buildRelationPayload(client.id);
    const userRel = this.buildRelationPayload((user as any).id);

    const tokenData: Record<string, unknown> = {
      accessToken: token.accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      scope: token.scope ?? [],
      client: clientRel,
      user: userRel,
    };
    if (token.refreshToken != null && token.refreshToken !== '') {
      tokenData.refreshToken = token.refreshToken;
      tokenData.refreshTokenExpiresAt = refreshTokenExpiresAt.toISOString();
    }

    const oauthTokensPayload = { data: tokenData };
    await this.request<StrapiSingleResponse<StrapiOAuthTokenAttributes>>(
      'oauth-tokens',
      {
        method: 'POST',
        body: JSON.stringify(oauthTokensPayload),
      },
      undefined,
      {
        requestLabel: 'POST oauth-tokens (saveToken)',
        requestBody: oauthTokensPayload,
      },
    );

    if (token.refreshToken) {
      const refreshPayload = {
        data: {
          refreshToken: token.refreshToken,
          refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
          scope: token.scope ?? [],
          client: clientRel,
          user: userRel,
        },
      };
      await this.request<StrapiSingleResponse<StrapiRefreshTokenAttributes>>(
        'oauth-refresh-tokens',
        {
          method: 'POST',
          body: JSON.stringify(refreshPayload),
        },
        undefined,
        {
          requestLabel: 'POST oauth-refresh-tokens (saveToken)',
          requestBody: refreshPayload,
        },
      );
    }

    return { ...token, client, user };
  }

  async getAccessToken(accessToken: string): Promise<OAuthToken | Falsey> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthTokenAttributes>>(
      'oauth-tokens',
      undefined,
      {
        'filters[accessToken][$eq]': accessToken,
        populate: '*',
      },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    if (!entity) {
      return null;
    }
    const mapped = this.mapOAuthToken(entity);
    return mapped ?? null;
  }

  async verifyScope(token: OAuthToken, scope: string[]): Promise<boolean> {
    if (!token.scope) return false;
    return scope.every((entry) => token.scope?.includes(entry));
  }

  async getUser(username: string, password: string, client: OAuthClient): Promise<OAuthUser | Falsey> {
    return this.findUserByCredentials(username, password);
  }

  async getUserFromClient(client: OAuthClient): Promise<OAuthUser | Falsey> {
    if ((client as any).user) {
      return (client as any).user as OAuthUser;
    }
    if (!(client as any).userId) {
      return null;
    }
    return this.getUserById(String((client as any).userId));
  }

  async getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
    const response = await this.request<StrapiCollectionResponse<StrapiRefreshTokenAttributes>>(
      'oauth-refresh-tokens',
      undefined,
      {
        'filters[refreshToken][$eq]': refreshToken,
        populate: '*',
      },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    if (!entity) {
      return null;
    }
    const mapped = this.mapRefreshToken(entity);
    return mapped ?? null;
  }

  async revokeToken(token: RefreshToken): Promise<boolean> {
    const existing = await this.getRefreshToken(token.refreshToken);
    if (!existing) {
      return false;
    }
    const entity = await this.request<StrapiCollectionResponse<StrapiRefreshTokenAttributes>>(
      'oauth-refresh-tokens',
      undefined,
      {
        'filters[refreshToken][$eq]': token.refreshToken,
      },
    );
    const found = this.pickFirst(entity);
    if (!found) {
      return false;
    }
    const documentId = this.getDocId(found);
    await this.request<unknown>(`oauth-refresh-tokens/${documentId}`, { method: 'DELETE' }, undefined);
    return true;
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
    const response = await this.request<StrapiCollectionResponse<StrapiAuthorizationCodeAttributes>>(
      'oauth-authorization-codes',
      undefined,
      {
        'filters[authorizationCode][$eq]': code,
        populate: '*',
      },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    if (!entity) {
      return null;
    }
    const mapped = this.mapAuthorizationCode(entity);
    return mapped ?? null;
  }

  async saveAuthorizationCode(
    code: Pick<
      AuthorizationCode,
      'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'
    >,
    client: OAuthClient,
    user: OAuthUser,
  ): Promise<AuthorizationCode> {
    const payload = {
      data: {
        authorizationCode: code.authorizationCode,
        expiresAt: code.expiresAt.toISOString(),
        redirectUri: code.redirectUri,
        scope: code.scope ?? [],
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod,
        client: this.buildRelationPayload(client.id),
        user: this.buildRelationPayload((user as any).id),
      },
    };
    await this.request<StrapiSingleResponse<StrapiAuthorizationCodeAttributes>>(
      'oauth-authorization-codes',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      { requestLabel: 'POST oauth-authorization-codes', requestBody: payload },
    );

    return {
      ...code,
      client,
      user,
    };
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    const response = await this.request<StrapiCollectionResponse<StrapiAuthorizationCodeAttributes>>(
      'oauth-authorization-codes',
      undefined,
      {
        'filters[authorizationCode][$eq]': code.authorizationCode,
      },
    );
    const entity = this.pickFirst(response);
    if (!entity) {
      return false;
    }
    await this.request<unknown>(`oauth-authorization-codes/${this.getDocId(entity)}`, { method: 'DELETE' }, undefined);
    return true;
  }

  async getProduct(productId: string): Promise<OAuthProduct | Falsey> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthProductAttributes>>(
      'oauth-products',
      undefined,
      {
        'filters[documentId][$eq]': productId,
      },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    if (!entity) {
      return null;
    }
    return this.mapProduct(entity);
  }

  async getProductClients(productId: string): Promise<OAuthClient[] | Falsey> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthClientAttributes>>(
      'oauth-clients',
      undefined,
      {
        'filters[product][documentId][$eq]': productId,
        populate: '*',
      },
    );
    this.ensureNoError(response);
    if (!response.data.length) {
      return null;
    }
    return response.data.map((entity) => this.mapClient(entity));
  }

  validateApiKey(apiKey: string | undefined): boolean {
    if (!apiKey) {
      return false;
    }
    if (!this.apiKeyCacheReady && !this.apiKeyCacheLoading) {
      void this.refreshApiKeyCache();
    }
    if (!this.apiKeysCache.has(apiKey)) {
      void this.refreshApiKeyCache();
    }
    return this.apiKeysCache.has(apiKey);
  }

  async validateBasicAuth(username: string, password: string): Promise<BasicAuthValidationResult | null> {
    const user = await this.findUserByCredentials(username, password);
    return user ? { user } : null;
  }

  async getAudiences(client: OAuthClient, user: OAuthUser): Promise<string[] | string | null> {
    const clientAudiences = this.normalizeStringArray((client as any).audiences);
    const userAudiences = this.normalizeStringArray((user as any).audiences);
    const combined = Array.from(new Set([...clientAudiences, ...userAudiences]));
    if (combined.length > 0) {
      return combined;
    }
    return ['umoja-clients'];
  }

  /**
   * Strapi documentIds are typically 24 alphanumeric chars. In-memory ids like "demo" must not be sent as relation.
   */
  private looksLikeStrapiDocumentId(value: unknown): boolean {
    if (value == null || typeof value !== 'string') return false;
    return /^[a-z0-9]{20,30}$/i.test(value) && value.length >= 20;
  }

  /**
   * Creates or updates an OAuth client in Strapi (demo helper).
   * Links to first available product and user when not provided so client_credentials works.
   * Only uses client.productId/userId when they look like Strapi documentIds; otherwise fetches first from Strapi.
   */
  async upsertClient(client: OAuthClient): Promise<OAuthClient> {
    this.logger.debug({ msg: 'upsertClient', clientId: client.id });
    const productId = client.productId ?? (client as any).product?.id;
    const userId = (client as any).userId ?? (client as any).user?.id;
    let productDocId =
      productId != null && this.looksLikeStrapiDocumentId(String(productId))
        ? this.resolveRelationId(productId)
        : undefined;
    let userDocId =
      userId != null && this.looksLikeStrapiDocumentId(String(userId)) ? this.resolveRelationId(userId) : undefined;
    if (!productDocId) {
      productDocId = await this.getFirstProductDocumentId();
    }
    if (!userDocId) {
      userDocId = await this.getFirstUserDocumentId();
    }
    const audienceValues = this.normalizeStringArray((client as any).audiences);
    const audienceDocIds = audienceValues.length > 0 ? await this.resolveAudienceDocumentIds(audienceValues) : [];
    const data: Record<string, unknown> = {
      redirectUris: client.redirectUris ?? [],
      clientSecret: client.clientSecret,
      grants: client.grants ?? ['client_credentials', 'password', 'refresh_token'],
      accessTokenLifetime: client.accessTokenLifetime ?? 1800,
      refreshTokenLifetime: client.refreshTokenLifetime ?? 604800,
    };
    if (productDocId) data.product = typeof productDocId === 'string' ? productDocId : productDocId;
    if (userDocId) data.user = typeof userDocId === 'string' ? userDocId : userDocId;
    if (audienceDocIds.length > 0) {
      data.audiences = { connect: audienceDocIds.map((id) => ({ documentId: id })) };
    }
    const payload = { data };
    const response = await this.request<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      'oauth-clients',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      { requestLabel: 'POST oauth-clients (upsertClient)', requestBody: payload },
    );
    this.ensureNoError(response);
    if (!response.data) {
      this.logger.error({ msg: 'upsertClient: no data in response' });
      throw new BadGatewayException('Control plane unavailable');
    }
    const mapped = this.mapClient(response.data);
    this.logger.log({ msg: 'upsertClient completed', clientId: mapped.id });
    return mapped;
  }

  /**
   * Creates or updates an OAuth user in Strapi (demo helper).
   */
  async upsertUser(user: OAuthUser & { password?: string }): Promise<OAuthUser> {
    this.logger.debug({ msg: 'upsertUser', username: user.username });
    const plainPassword = (user as any).password ?? '';
    const audienceValues = this.normalizeStringArray((user as any).audiences);
    const audienceDocIds = audienceValues.length > 0 ? await this.resolveAudienceDocumentIds(audienceValues) : await this.resolveAudienceDocumentIds(['umoja-clients']);
    const data: Record<string, unknown> = {
      username: user.username,
      password: plainPassword,
    };
    if (audienceDocIds.length > 0) {
      data.audiences = { connect: audienceDocIds.map((id) => ({ documentId: id })) };
    }
    const payload = { data };
    const response = await this.request<StrapiSingleResponse<StrapiOAuthUserAttributes>>(
      'oauth-users',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      { requestLabel: 'POST oauth-users (upsertUser)', requestBody: { data: { username: user.username, audiencesCount: audienceDocIds.length } } },
    );
    this.ensureNoError(response);
    if (!response.data) {
      this.logger.error({ msg: 'upsertUser: no data in response' });
      throw new BadGatewayException('Control plane unavailable');
    }
    const mapped = this.mapUser(response.data);
    this.logger.log({ msg: 'upsertUser completed', userId: mapped.id, username: mapped.username });
    return mapped;
  }

  private async getFirstProductDocumentId(): Promise<string | undefined> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthProductAttributes>>(
      'oauth-products',
      undefined,
      { 'pagination[pageSize]': 1 },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    return entity ? this.getDocId(entity) : undefined;
  }

  private async getFirstUserDocumentId(): Promise<string | undefined> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthUserAttributes>>(
      'oauth-users',
      undefined,
      { 'pagination[pageSize]': 1 },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    return entity ? this.getDocId(entity) : undefined;
  }

  private async resolveAudienceDocumentIds(values: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const value of values) {
      const response = await this.request<StrapiCollectionResponse<StrapiAudienceAttributes>>(
        'oauth-audiences',
        undefined,
        { 'filters[value][$eq]': value, 'pagination[pageSize]': 1 },
      );
      this.ensureNoError(response);
      const entity = this.pickFirst(response);
      if (entity) ids.push(this.getDocId(entity));
    }
    return ids;
  }

  private async findUserByCredentials(username: string, password: string): Promise<OAuthUser | null> {
    const response = await this.request<StrapiCollectionResponse<StrapiOAuthUserAttributes>>(
      'oauth-users',
      undefined,
      {
        'filters[username][$eq]': username,
        'filters[password][$eq]': password,
        populate: 'audiences',
      },
    );
    this.ensureNoError(response);
    const entity = this.pickFirst(response);
    if (!entity) {
      return null;
    }
    return this.mapUser(entity);
  }

  private async getUserById(userId: string): Promise<OAuthUser | null> {
    const response = await this.request<StrapiSingleResponse<StrapiOAuthUserAttributes>>(
      `oauth-users/${userId}`,
      undefined,
      {
        populate: 'audiences',
      },
    );
    this.ensureNoError(response);
    if (!response.data) {
      return null;
    }
    return this.mapUser(response.data);
  }

  private getDocId(entity: StrapiEntity<unknown>): string {
    const id = entity.documentId ?? entity.id;
    return id != null ? String(id) : '';
  }

  private getAttrs<T>(entity: StrapiEntity<T>): T {
    return (entity.attributes ?? entity) as T;
  }

  private mapClient(entity: StrapiEntity<StrapiOAuthClientAttributes>): OAuthClient {
    const attrs = this.getAttrs(entity);
    const product = this.mapProductRelation(attrs.product);
    const user = this.mapUserRelation(attrs.user);
    const audiences = this.mapAudienceRelation(attrs.audiences);
    const userId =
      (user as any)?.id ??
      this.getRelationUserId(attrs.user);

    return {
      id: this.getDocId(entity),
      redirectUris: this.normalizeStringArray(attrs.redirectUris),
      clientSecret: attrs.clientSecret,
      grants: this.normalizeStringArray(attrs.grants),
      accessTokenLifetime: attrs.accessTokenLifetime,
      refreshTokenLifetime: attrs.refreshTokenLifetime,
      productId: product?.id,
      product,
      userId,
      user,
      audiences,
    };
  }

  /**
   * Extracts user documentId/id from a relation when it is a bare id or minimal object.
   * Used so getUserFromClient can call getUserById when populate returns only an id.
   */
  private getRelationUserId(relation: unknown): string | undefined {
    if (relation == null) {
      return undefined;
    }
    if (typeof relation === 'number' || typeof relation === 'string') {
      return String(relation);
    }
    if (typeof relation === 'object') {
      const r = relation as Record<string, unknown>;
      if (r.documentId != null) return String(r.documentId);
      if (r.id != null) return String(r.id);
      if (r.data != null && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>;
        if (d.documentId != null) return String(d.documentId);
        if (d.id != null) return String(d.id);
      }
    }
    return undefined;
  }

  private mapProduct(entity: StrapiEntity<StrapiOAuthProductAttributes>): OAuthProduct {
    const attrs = this.getAttrs(entity);
    return {
      id: this.getDocId(entity),
      name: attrs.name,
      description: attrs.description ?? undefined,
      logoUri: attrs.logoUri ?? undefined,
      privacyPolicyUrl: attrs.privacyPolicyUrl ?? undefined,
      termsOfServiceUrl: attrs.termsOfServiceUrl ?? undefined,
      owners: this.normalizeStringArray(attrs.owners),
    };
  }

  private mapUser(entity: StrapiEntity<StrapiOAuthUserAttributes>): OAuthUser {
    const attrs = this.getAttrs(entity);
    return {
      id: this.getDocId(entity),
      username: attrs.username,
      audiences: this.mapAudienceRelation(attrs.audiences),
    };
  }

  private mapOAuthToken(entity: StrapiEntity<StrapiOAuthTokenAttributes>): OAuthToken | null {
    const attrs = this.getAttrs(entity);
    const client = this.mapClientRelation(attrs.client);
    const user = this.mapUserRelation(attrs.user);
    if (!client || !user) {
      return null;
    }
    return {
      accessToken: attrs.accessToken,
      accessTokenExpiresAt: this.toDate(attrs.accessTokenExpiresAt),
      refreshToken: attrs.refreshToken ?? undefined,
      refreshTokenExpiresAt: this.toDate(attrs.refreshTokenExpiresAt ?? undefined),
      scope: this.normalizeStringArray(attrs.scope),
      client,
      user,
    };
  }

  private mapRefreshToken(entity: StrapiEntity<StrapiRefreshTokenAttributes>): RefreshToken | null {
    const attrs = this.getAttrs(entity);
    const client = this.mapClientRelation(attrs.client);
    const user = this.mapUserRelation(attrs.user);
    if (!client || !user) {
      return null;
    }
    return {
      refreshToken: attrs.refreshToken,
      refreshTokenExpiresAt: this.toDate(attrs.refreshTokenExpiresAt),
      scope: this.normalizeStringArray(attrs.scope),
      client,
      user,
    };
  }

  private mapAuthorizationCode(
    entity: StrapiEntity<StrapiAuthorizationCodeAttributes>,
  ): AuthorizationCode | null {
    const attrs = this.getAttrs(entity);
    const client = this.mapClientRelation(attrs.client);
    const user = this.mapUserRelation(attrs.user);
    if (!client || !user) {
      return null;
    }
    return {
      authorizationCode: attrs.authorizationCode,
      expiresAt: this.toDate(attrs.expiresAt) ?? new Date(),
      redirectUri: attrs.redirectUri,
      scope: this.normalizeStringArray(attrs.scope),
      codeChallenge: attrs.codeChallenge ?? undefined,
      codeChallengeMethod: attrs.codeChallengeMethod ?? undefined,
      client,
      user,
    };
  }

  /**
   * Normalizes Strapi relation to a single entity.
   * Supports v4 shape ({ data: entity }) and v5 flat shape (entity with documentId at root).
   */
  private getRelationSingle<T>(relation: RelationSingle<T>): StrapiEntity<T> | null {
    if (relation == null) {
      return null;
    }
    if ('data' in relation && relation.data != null) {
      return relation.data as StrapiEntity<T>;
    }
    const entity = relation as StrapiEntity<T>;
    if (entity.documentId != null || entity.id != null) {
      return entity;
    }
    return null;
  }

  /**
   * Normalizes Strapi relation to an array of entities.
   * Supports v4 shape ({ data: [] }) and v5 flat shape (array of entities).
   */
  private getRelationMany<T>(relation: RelationMany<T>): StrapiEntity<T>[] {
    if (relation == null) {
      return [];
    }
    if (Array.isArray(relation)) {
      return relation;
    }
    if (relation.data && Array.isArray(relation.data)) {
      return relation.data;
    }
    return [];
  }

  private mapProductRelation(relation: RelationSingle<StrapiOAuthProductAttributes>): OAuthProduct | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapProduct(entity) : undefined;
  }

  private mapClientRelation(relation: RelationSingle<StrapiOAuthClientAttributes>): OAuthClient | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapClient(entity) : undefined;
  }

  private mapUserRelation(relation: RelationSingle<StrapiOAuthUserAttributes>): OAuthUser | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapUser(entity) : undefined;
  }

  private mapAudienceRelation(relation: RelationMany<StrapiAudienceAttributes>): string[] {
    const data = this.getRelationMany(relation);
    return data
      .map((entry) => this.getAttrs(entry).value)
      .filter((value): value is string => Boolean(value));
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === 'string') {
      return value.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
  }

  private toDate(value: string | Date | undefined | null): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  /**
   * Returns the value to send for a relation in Strapi API payloads.
   * Strapi v5 expects documentId (string); v4 may accept numeric id.
   */
  private resolveRelationId(value: unknown): string | number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  /**
   * Builds relation payload for Strapi create/update.
   * Strapi v5 accepts short format: documentId string (or numeric id for v4) directly.
   * Do not use { connect: [...] } for many-to-one on create – it causes 500.
   */
  private buildRelationPayload(value: unknown): string | number | undefined {
    return this.resolveRelationId(value);
  }

  private resolveNumericId(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  private pickFirst<T>(response: StrapiCollectionResponse<T>): StrapiEntity<T> | null {
    if (!response.data || response.data.length === 0) {
      return null;
    }
    return response.data[0];
  }

  private ensureNoError<T extends { error?: StrapiError }>(response: T): void {
    if (response.error) {
      this.logger.error({
        msg: 'Strapi responded with an error',
        error: response.error,
      });
      throw new BadGatewayException(response.error.message ?? 'Control plane unavailable');
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(`${this.baseUrl}/api/${normalizedPath}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private buildHeaders(extra?: HeadersInit): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...(extra ?? {}),
    };
  }

  /**
   * Optional context to log on failure (e.g. request body) for debugging.
   */
  private async request<T>(
    path: string,
    init?: RequestInit,
    query?: Record<string, string | number | boolean | undefined>,
    debugContext?: { requestBody?: unknown; requestLabel?: string },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = this.buildUrl(path, query);
    const method = init?.method ?? 'GET';

    try {
      const response = await fetch(url, {
        ...init,
        headers: this.buildHeaders(init?.headers),
        signal: controller.signal,
      });
      if (!response.ok) {
        let responseBody: unknown = null;
        const responseText = await response.text();
        try {
          responseBody = responseText ? (JSON.parse(responseText) as unknown) : null;
        } catch {
          responseBody = { _raw: responseText.slice(0, 500) };
        }
        this.logger.error({
          msg: 'Strapi request failed',
          method,
          path,
          url,
          status: response.status,
          statusText: response.statusText,
          responseBody,
          ...(debugContext?.requestBody !== undefined && {
            requestBodySent: debugContext.requestBody,
          }),
          ...(debugContext?.requestLabel && { requestLabel: debugContext.requestLabel }),
        });
        throw new BadGatewayException('Control plane unavailable');
      }
      const responseText = await response.text();
      if (!responseText || !responseText.trim()) {
        return {} as T;
      }
      try {
        return JSON.parse(responseText) as T;
      } catch {
        return {} as T;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.logger.error({
          msg: 'Strapi request timed out',
          method,
          path,
          url,
          timeoutMs: this.timeoutMs,
          ...(debugContext?.requestBody !== undefined && {
            requestBodySent: debugContext.requestBody,
          }),
        });
      } else {
        const err = error as Error;
        this.logger.error({
          msg: 'Strapi request threw',
          method,
          path,
          url,
          error: err.message,
          errorName: err.name,
          ...(err.stack && { stack: err.stack }),
          ...(debugContext?.requestBody !== undefined && {
            requestBodySent: debugContext.requestBody,
          }),
          ...(debugContext?.requestLabel && { requestLabel: debugContext.requestLabel }),
        });
      }
      throw new BadGatewayException('Control plane unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  private async refreshApiKeyCache(): Promise<void> {
    if (this.apiKeyCacheLoading) {
      return;
    }
    this.apiKeyCacheLoading = true;
    try {
      const response = await this.request<StrapiCollectionResponse<StrapiApiKeyAttributes>>(
        'oauth-api-keys',
        undefined,
        {
          populate: 'client',
        },
      );
      this.ensureNoError(response);
      const data = Array.isArray(response.data) ? response.data : [];
      this.apiKeysCache = new Set(
        data
          .map((entity) => (entity ? this.getAttrs(entity).apiKey : undefined))
          .filter((value): value is string => Boolean(value)),
      );
      this.apiKeyCacheReady = true;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to refresh API key cache',
        error: String(error),
      });
    } finally {
      this.apiKeyCacheLoading = false;
    }
  }
}
