import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthClientAttributes } from '../entities/oauth-client.attributes';

/**
 * Strapi client for the oauth-clients collection.
 * Exposes GET by id, GET list, and POST (create).
 */
/** Default populate query for product, user, and audiences relations. */
const POPULATE_PRODUCT_USER_AUDIENCES: StrapiQueryParams = {
  'populate[0]': 'product',
  'populate[1]': 'user',
  'populate[2]': 'audiences',
};

@Injectable()
export class OAuthClientsStrapiClient {
  private readonly COLLECTION = 'oauth-clients';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Returns the default query params to populate product, user, and audiences.
   * Use with getById or getList when full relation data is needed.
   */
  getPopulateProductUserAudiences(): StrapiQueryParams {
    return { ...POPULATE_PRODUCT_USER_AUDIENCES };
  }

  getListByClientSecret(
    clientSecret: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes>[]> {
    return this.getList({
      'filters[clientSecret][$eq]': clientSecret,
      ...POPULATE_PRODUCT_USER_AUDIENCES,
      ...extraQuery,
    });
  }

  /**
   * Fetches the first oauth-client matching clientSecret, or null.
   */
  getFirstByClientSecret(
    clientSecret: string,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    return this.getListByClientSecret(clientSecret).pipe(firstOrNull());
  }

  getListByNumericId(
    numericId: number,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes>[]> {
    return this.getList({
      'filters[id][$eq]': numericId,
      ...POPULATE_PRODUCT_USER_AUDIENCES,
      ...extraQuery,
    });
  }

  /**
   * Fetches the first oauth-client matching numeric id, or null.
   */
  getFirstByNumericId(
    numericId: number,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    return this.getListByNumericId(numericId).pipe(firstOrNull());
  }

  getListByProductId(
    productId: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes>[]> {
    return this.getList({
      'filters[product][documentId][$eq]': productId,
      populate: '*',
      ...extraQuery,
    });
  }

  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthClientAttributes> | null }>(path, query)
      .pipe(map((r) => r.data ?? null));
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthClientAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }

  create(
    data: { data: Record<string, unknown> },
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    return this.client
      .post<{ data: StrapiEntity<StrapiOAuthClientAttributes> | null }>(
        this.COLLECTION,
        data,
        undefined,
      )
      .pipe(map((r) => r.data ?? null));
  }

  put(
    id: string,
    data: { data: Record<string, unknown> },
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client
      .put<{ data: StrapiEntity<StrapiOAuthClientAttributes> | null }>(
        path,
        data,
        query,
      )
      .pipe(map((r) => r.data ?? null));
  }
}
