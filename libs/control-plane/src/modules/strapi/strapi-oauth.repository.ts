import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { firstValueFrom, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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
import { OAuthApiKeysStrapiClient, OAuthAudiencesStrapiClient, OAuthAuthorizationCodesStrapiClient, OAuthClientsStrapiClient, OAuthProductsStrapiClient, OAuthRefreshTokensStrapiClient, OAuthTokensStrapiClient, OAuthUsersStrapiClient } from './strapi-http/clients';
import {
  StrapiOAuthApiKeyAttributes,
  StrapiOAuthClientAttributes,
} from './strapi-http/entities';
import { whenPresent } from './strapi-http/infra/operators';
import { StrapiToOAuthMapperService } from './strapi-http/infra/strapi-to-oauth-mapper.service';
import { StrapiEntityViewService } from './strapi-http/infra/strapi-entity-view.service';
import type { StrapiEntity } from './strapi-http/infra/strapi.types';

/**
 * Auth repository backed by the Strapi control plane.
 * Performs CRUD operations against Strapi collections using the provided API token.
 */
@Injectable()
export class StrapiOAuthRepository implements AuthRepository {
  private readonly logger = new Logger(StrapiOAuthRepository.name);
  private apiKeysCache = new Set<string>();
  private apiKeyCacheReady = false;
  private apiKeyCacheLoading = false;

  constructor(
    private readonly strapiEntityView: StrapiEntityViewService,
    private readonly strapiToOAuthMapper: StrapiToOAuthMapperService,
    private readonly oauthClientsClient: OAuthClientsStrapiClient,
    private readonly oauthTokensClient: OAuthTokensStrapiClient,
    private readonly oauthRefreshTokensClient: OAuthRefreshTokensStrapiClient,
    private readonly oauthAuthorizationCodesClient: OAuthAuthorizationCodesStrapiClient,
    private readonly oauthProductsClient: OAuthProductsStrapiClient,
    private readonly oauthUsersClient: OAuthUsersStrapiClient,
    private readonly oauthAudiencesClient: OAuthAudiencesStrapiClient,
    private readonly oauthApiKeysClient: OAuthApiKeysStrapiClient,
  ) {
    void this.refreshApiKeyCache();
  }

  // ========== AuthRepository (interface) ==========

  async getClient(clientId: string, clientSecret: string | null): Promise<OAuthClient | Falsey> {
    const populateQuery = this.oauthClientsClient.getPopulateProductUserAudiences();
    return firstValueFrom(
      this.oauthClientsClient.getById(clientId, populateQuery).pipe(
        whenPresent((entity) => {
          const client = this.strapiToOAuthMapper.mapClient(entity);
          if (clientSecret && client.clientSecret !== clientSecret) return null;
          return client;
        }),
        catchError(() =>
          this.getClientByNumericId(clientId, clientSecret).pipe(
            switchMap((byNumericId) => {
              if (byNumericId) return of(byNumericId);
              if (clientSecret == null || clientSecret === '')
                return of(null);
              return this.oauthClientsClient
                .getFirstByClientSecret(clientSecret)
                .pipe(
                  whenPresent((entity) => {
                    if (!this.clientIdMatchesEntity(entity, clientId))
                      return null;
                    const client = this.strapiToOAuthMapper.mapClient(entity);
                    return client.clientSecret === clientSecret ? client : null;
                  }),
                );
            }),
          ),
        ),
      ),
      { defaultValue: null },
    );
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
    await firstValueFrom(this.oauthTokensClient.create(oauthTokensPayload));

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
      await firstValueFrom(this.oauthRefreshTokensClient.create(refreshPayload));
    }

    return { ...token, client, user };
  }

  async getAccessToken(accessToken: string): Promise<OAuthToken | Falsey> {
    return firstValueFrom(
      this.oauthTokensClient
        .getFirstByAccessToken(accessToken)
        .pipe(this.strapiToOAuthMapper.whenPresentMapToOAuthToken()),
      { defaultValue: null },
    );
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
    return firstValueFrom(
      this.oauthRefreshTokensClient
        .getFirstByRefreshToken(refreshToken, { populate: true })
        .pipe(this.strapiToOAuthMapper.whenPresentMapToRefreshToken()),
      { defaultValue: null },
    );
  }

  async revokeToken(token: RefreshToken): Promise<boolean> {
    const existing = await this.getRefreshToken(token.refreshToken);
    if (!existing) {
      return false;
    }
    const found = await firstValueFrom(
      this.oauthRefreshTokensClient.getFirstByRefreshToken(token.refreshToken),
    );
    if (!found) {
      return false;
    }
    await firstValueFrom(
      this.oauthRefreshTokensClient.deleteByEntity(found),
    );
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
    return firstValueFrom(
      this.oauthAuthorizationCodesClient
        .getFirstByAuthorizationCode(code, { populate: true })
        .pipe(this.strapiToOAuthMapper.whenPresentMapToAuthorizationCode()),
      { defaultValue: null },
    );
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
    await firstValueFrom(this.oauthAuthorizationCodesClient.create(payload));

    return {
      ...code,
      client,
      user,
    };
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    const entity = await firstValueFrom(
      this.oauthAuthorizationCodesClient.getFirstByAuthorizationCode(
        code.authorizationCode,
      ),
    );
    if (!entity) {
      return false;
    }
    await firstValueFrom(
      this.oauthAuthorizationCodesClient.deleteByEntity(entity),
    );
    return true;
  }

  async getProduct(productId: string): Promise<OAuthProduct | Falsey> {
    return firstValueFrom(
      this.oauthProductsClient
        .getFirstByDocumentId(productId)
        .pipe(this.strapiToOAuthMapper.whenPresentMapToOAuthProduct()),
      { defaultValue: null },
    );
  }

  async getProductClients(productId: string): Promise<OAuthClient[] | Falsey> {
    const data = await firstValueFrom(
      this.oauthClientsClient.getListByProductId(productId),
    );
    if (!data.length) return null;
    return data.map((entity) => this.strapiToOAuthMapper.mapClient(entity));
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
    const clientAudiences = this.strapiToOAuthMapper.normalizeStringArray((client as any).audiences);
    const userAudiences = this.strapiToOAuthMapper.normalizeStringArray((user as any).audiences);
    const combined = Array.from(new Set([...clientAudiences, ...userAudiences]));
    if (combined.length > 0) {
      return combined;
    }
    return ['umoja-clients'];
  }

  // ========== Additional public (demo helpers) ==========

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
    const audienceValues = this.strapiToOAuthMapper.normalizeStringArray((client as any).audiences);
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
    const entity = await firstValueFrom(
      this.oauthClientsClient.create(payload),
    );
    if (!entity) {
      this.logger.error({ msg: 'upsertClient: no data in response' });
      throw new BadGatewayException('Control plane unavailable');
    }
    const mapped = this.strapiToOAuthMapper.mapClient(entity);
    this.logger.log({ msg: 'upsertClient completed', clientId: mapped.id });
    return mapped;
  }

  /**
   * Creates or updates an OAuth user in Strapi (demo helper).
   */
  async upsertUser(user: OAuthUser & { password?: string }): Promise<OAuthUser> {
    this.logger.debug({ msg: 'upsertUser', username: user.username });
    const plainPassword = (user as any).password ?? '';
    const audienceValues = this.strapiToOAuthMapper.normalizeStringArray((user as any).audiences);
    const audienceDocIds = audienceValues.length > 0 ? await this.resolveAudienceDocumentIds(audienceValues) : await this.resolveAudienceDocumentIds(['umoja-clients']);
    const data: Record<string, unknown> = {
      username: user.username,
      password: plainPassword,
    };
    if (audienceDocIds.length > 0) {
      data.audiences = { connect: audienceDocIds.map((id) => ({ documentId: id })) };
    }
    const payload = { data };
    const entity = await firstValueFrom(
      this.oauthUsersClient.create(payload),
    );
    if (!entity) {
      this.logger.error({ msg: 'upsertUser: no data in response' });
      throw new BadGatewayException('Control plane unavailable');
    }
    const mapped = this.strapiToOAuthMapper.mapUser(entity);
    this.logger.log({ msg: 'upsertUser completed', userId: mapped.id, username: mapped.username });
    return mapped;
  }

  // ========== Private (internal use) ==========

  private clientIdMatchesEntity(entity: StrapiEntity<StrapiOAuthClientAttributes>, clientId: string): boolean {
    if (this.strapiEntityView.toView(entity).getDocId() === clientId) return true;
    const numId = entity.id ?? (entity as Record<string, unknown>).id;
    return numId != null && String(numId) === clientId;
  }

  /**
   * Resolves client by numeric id (Strapi v4 style). Returns observable that emits at most one client or null.
   */
  private getClientByNumericId(
    clientId: string,
    clientSecret: string | null,
  ): Observable<OAuthClient | null> {
    const numericId = Number(clientId);
    if (Number.isNaN(numericId) || numericId < 1) return of(null);
    return this.oauthClientsClient.getFirstByNumericId(numericId).pipe(
      whenPresent((entity) => {
        const client = this.strapiToOAuthMapper.mapClient(entity);
        if (
          clientSecret != null &&
          clientSecret !== '' &&
          client.clientSecret !== clientSecret
        )
          return null;
        return client;
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * Strapi documentIds are typically 24 alphanumeric chars. In-memory ids like "demo" must not be sent as relation.
   */
  private looksLikeStrapiDocumentId(value: unknown): boolean {
    if (value == null || typeof value !== 'string') return false;
    return /^[a-z0-9]{20,30}$/i.test(value) && value.length >= 20;
  }

  private async getFirstProductDocumentId(): Promise<string | undefined> {
    const entity = await firstValueFrom(
      this.oauthProductsClient.getFirstFromList(1),
    );
    return entity ? this.strapiEntityView.toView(entity).getDocId() : undefined;
  }

  private async getFirstUserDocumentId(): Promise<string | undefined> {
    const entity = await firstValueFrom(
      this.oauthUsersClient.getFirstFromList(1),
    );
    return entity ? this.strapiEntityView.toView(entity).getDocId() : undefined;
  }

  private async resolveAudienceDocumentIds(values: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const value of values) {
      const entity = await firstValueFrom(
        this.oauthAudiencesClient.getFirstByValue(value),
      );
      if (entity) ids.push(this.strapiEntityView.toView(entity).getDocId());
    }
    return ids;
  }

  private async findUserByCredentials(username: string, password: string): Promise<OAuthUser | null> {
    return firstValueFrom(
      this.oauthUsersClient
        .getFirstByCredentials(username, password)
        .pipe(this.strapiToOAuthMapper.whenPresentMapToOAuthUser()),
      { defaultValue: null },
    );
  }

  private async getUserById(userId: string): Promise<OAuthUser | null> {
    return firstValueFrom(
      this.oauthUsersClient
        .getByIdWithAudiences(userId)
        .pipe(this.strapiToOAuthMapper.whenPresentMapToOAuthUser()),
      { defaultValue: null },
    );
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

  private async refreshApiKeyCache(): Promise<void> {
    if (this.apiKeyCacheLoading) {
      return;
    }
    this.apiKeyCacheLoading = true;
    try {
      const data = await firstValueFrom(
        this.oauthApiKeysClient.getListWithClientPopulate(),
      );
      const list = Array.isArray(data) ? data : [];
      this.apiKeysCache = new Set(
        list
          .map((entity) => (entity ? this.strapiEntityView.toView(entity).getAttrs().apiKey : undefined))
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
