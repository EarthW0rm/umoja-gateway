import { Injectable } from '@nestjs/common';
import type {
  AuthorizationCode,
  OAuthClient,
  OAuthProduct,
  OAuthToken,
  OAuthUser,
  RefreshToken,
} from '@oauth/oauth';
import type { OperatorFunction } from 'rxjs';
import {
  StrapiOAuthAudienceAttributes,
  StrapiOAuthAuthorizationCodeAttributes,
  StrapiOAuthClientAttributes,
  StrapiOAuthProductAttributes,
  StrapiOAuthRefreshTokenAttributes,
  StrapiOAuthTokenAttributes,
  StrapiOAuthUserAttributes,
} from '../entities';
import { whenPresent } from './operators';
import { StrapiEntityViewService } from './strapi-entity-view.service';
import type {
  StrapiEntity,
  StrapiRelationMany,
  StrapiRelationSingle,
} from './strapi.types';

/**
 * Contract for Strapi entity → OAuth domain mappers.
 * Implemented by {@link StrapiToOAuthMapperService}.
 */
export interface StrapiEntityMappers {
  mapClient(entity: StrapiEntity<StrapiOAuthClientAttributes>): OAuthClient;
  mapProduct(entity: StrapiEntity<StrapiOAuthProductAttributes>): OAuthProduct;
  mapUser(entity: StrapiEntity<StrapiOAuthUserAttributes>): OAuthUser;
  mapOAuthToken(
    entity: StrapiEntity<StrapiOAuthTokenAttributes>,
  ): OAuthToken | null;
  mapRefreshToken(
    entity: StrapiEntity<StrapiOAuthRefreshTokenAttributes>,
  ): RefreshToken | null;
  mapAuthorizationCode(
    entity: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>,
  ): AuthorizationCode | null;
}

/**
 * Injectable service that maps Strapi entities to OAuth domain models.
 * Centralizes all Strapi → OAuth mapping logic and exposes both mapping methods
 * and RxJS operators that close over the service (no need to pass `this`).
 *
 * Use in repositories or services that need to transform Strapi HTTP responses
 * into domain objects. For pipes, use the whenPresentMapTo* operators.
 */
@Injectable()
export class StrapiToOAuthMapperService implements StrapiEntityMappers {
  constructor(private readonly strapiEntityView: StrapiEntityViewService) {}

  // ========== Public mapping API (StrapiEntityMappers) ==========

  mapClient(entity: StrapiEntity<StrapiOAuthClientAttributes>): OAuthClient {
    const view = this.strapiEntityView.toView(entity);
    const attrs = view.getAttrs();
    const product = this.mapProductRelation(
      attrs.product as StrapiRelationSingle<StrapiOAuthProductAttributes>,
    );
    const user = this.mapUserRelation(
      attrs.user as StrapiRelationSingle<StrapiOAuthUserAttributes>,
    );
    const audiences = this.mapAudienceRelation(
      attrs.audiences as StrapiRelationMany<StrapiOAuthAudienceAttributes>,
    );
    const userId =
      (user as OAuthUser & { id?: string })?.id ??
      this.getRelationUserId(attrs.user);

    return {
      id: view.getDocId(),
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

  mapProduct(entity: StrapiEntity<StrapiOAuthProductAttributes>): OAuthProduct {
    const view = this.strapiEntityView.toView(entity);
    const attrs = view.getAttrs();
    return {
      id: view.getDocId(),
      name: attrs.name,
      description: attrs.description ?? undefined,
      logoUri: attrs.logoUri ?? undefined,
      privacyPolicyUrl: attrs.privacyPolicyUrl ?? undefined,
      termsOfServiceUrl: attrs.termsOfServiceUrl ?? undefined,
      owners: this.normalizeStringArray(attrs.owners),
    };
  }

  mapUser(entity: StrapiEntity<StrapiOAuthUserAttributes>): OAuthUser {
    const view = this.strapiEntityView.toView(entity);
    const attrs = view.getAttrs();
    return {
      id: view.getDocId(),
      username: attrs.username,
      audiences: this.mapAudienceRelation(
        attrs.audiences as StrapiRelationMany<StrapiOAuthAudienceAttributes>,
      ),
    };
  }

  mapOAuthToken(
    entity: StrapiEntity<StrapiOAuthTokenAttributes>,
  ): OAuthToken | null {
    const attrs = this.strapiEntityView.toView(entity).getAttrs();
    const client = this.mapClientRelation(
      attrs.client as StrapiRelationSingle<StrapiOAuthClientAttributes>,
    );
    const user = this.mapUserRelation(
      attrs.user as StrapiRelationSingle<StrapiOAuthUserAttributes>,
    );
    if (!client || !user) {
      return null;
    }
    return {
      accessToken: attrs.accessToken,
      accessTokenExpiresAt: this.toDate(attrs.accessTokenExpiresAt),
      refreshToken: attrs.refreshToken ?? undefined,
      refreshTokenExpiresAt: this.toDate(
        attrs.refreshTokenExpiresAt ?? undefined,
      ),
      scope: this.normalizeStringArray(attrs.scope),
      client,
      user,
    };
  }

  mapRefreshToken(
    entity: StrapiEntity<StrapiOAuthRefreshTokenAttributes>,
  ): RefreshToken | null {
    const attrs = this.strapiEntityView.toView(entity).getAttrs();
    const client = this.mapClientRelation(
      attrs.client as StrapiRelationSingle<StrapiOAuthClientAttributes>,
    );
    const user = this.mapUserRelation(
      attrs.user as StrapiRelationSingle<StrapiOAuthUserAttributes>,
    );
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

  mapAuthorizationCode(
    entity: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>,
  ): AuthorizationCode | null {
    const attrs = this.strapiEntityView.toView(entity).getAttrs();
    const client = this.mapClientRelation(
      attrs.client as StrapiRelationSingle<StrapiOAuthClientAttributes>,
    );
    const user = this.mapUserRelation(
      attrs.user as StrapiRelationSingle<StrapiOAuthUserAttributes>,
    );
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
   * Normalizes a value to a string array (Strapi may return string, array, or comma-separated).
   * Exposed for callers that need to normalize domain or payload values (e.g. audiences).
   *
   * @param value - Raw value from Strapi or domain object.
   * @returns Array of non-empty strings.
   */
  normalizeStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  // ========== RxJS operators (close over this service; no passing mappers) ==========

  /**
   * Operator: when value is present, map Strapi oauth-client entity to OAuthClient; otherwise emit null.
   */
  whenPresentMapToOAuthClient(): OperatorFunction<
    StrapiEntity<StrapiOAuthClientAttributes> | null | undefined,
    OAuthClient | null
  > {
    return whenPresent((entity) => this.mapClient(entity));
  }

  /**
   * Operator: when value is present, map Strapi oauth-product entity to OAuthProduct; otherwise emit null.
   */
  whenPresentMapToOAuthProduct(): OperatorFunction<
    StrapiEntity<StrapiOAuthProductAttributes> | null | undefined,
    OAuthProduct | null
  > {
    return whenPresent((entity) => this.mapProduct(entity));
  }

  /**
   * Operator: when value is present, map Strapi oauth-user entity to OAuthUser; otherwise emit null.
   */
  whenPresentMapToOAuthUser(): OperatorFunction<
    StrapiEntity<StrapiOAuthUserAttributes> | null | undefined,
    OAuthUser | null
  > {
    return whenPresent((entity) => this.mapUser(entity));
  }

  /**
   * Operator: when value is present, map Strapi oauth-token entity to OAuthToken | null; otherwise emit null.
   */
  whenPresentMapToOAuthToken(): OperatorFunction<
    StrapiEntity<StrapiOAuthTokenAttributes> | null | undefined,
    OAuthToken | null
  > {
    return whenPresent((entity) => this.mapOAuthToken(entity));
  }

  /**
   * Operator: when value is present, map Strapi oauth-refresh-token entity to RefreshToken | null; otherwise emit null.
   */
  whenPresentMapToRefreshToken(): OperatorFunction<
    StrapiEntity<StrapiOAuthRefreshTokenAttributes> | null | undefined,
    RefreshToken | null
  > {
    return whenPresent((entity) => this.mapRefreshToken(entity));
  }

  /**
   * Operator: when value is present, map Strapi oauth-authorization-code entity to AuthorizationCode | null; otherwise emit null.
   */
  whenPresentMapToAuthorizationCode(): OperatorFunction<
    StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> | null | undefined,
    AuthorizationCode | null
  > {
    return whenPresent((entity) => this.mapAuthorizationCode(entity));
  }

  // ========== Relation and attribute helpers (private) ==========

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

  private getRelationSingle<T>(
    relation: StrapiRelationSingle<T>,
  ): StrapiEntity<T> | null {
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

  private getRelationMany<T>(
    relation: StrapiRelationMany<T>,
  ): StrapiEntity<T>[] {
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

  private mapProductRelation(
    relation: StrapiRelationSingle<StrapiOAuthProductAttributes>,
  ): OAuthProduct | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapProduct(entity) : undefined;
  }

  private mapClientRelation(
    relation: StrapiRelationSingle<StrapiOAuthClientAttributes>,
  ): OAuthClient | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapClient(entity) : undefined;
  }

  private mapUserRelation(
    relation: StrapiRelationSingle<StrapiOAuthUserAttributes>,
  ): OAuthUser | undefined {
    const entity = this.getRelationSingle(relation);
    return entity ? this.mapUser(entity) : undefined;
  }

  private mapAudienceRelation(
    relation: StrapiRelationMany<StrapiOAuthAudienceAttributes>,
  ): string[] {
    const data = this.getRelationMany(relation);
    return data
      .map((entry) => this.strapiEntityView.toView(entry).getAttrs().value)
      .filter((value): value is string => Boolean(value));
  }

  private toDate(value: string | Date | undefined | null): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
