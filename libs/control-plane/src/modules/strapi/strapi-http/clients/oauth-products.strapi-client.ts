import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthProductAttributes } from '../entities/oauth-product.attributes';

/**
 * Strapi client for the oauth-products collection.
 * Exposes GET list, GET by id, and getFirst* helpers.
 */
@Injectable()
export class OAuthProductsStrapiClient {
  private readonly COLLECTION = 'oauth-products';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches the first oauth-product matching documentId, or null.
   */
  getFirstByDocumentId(
    documentId: string,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes> | null> {
    return this.getListByDocumentId(documentId).pipe(firstOrNull());
  }

  /**
   * Fetches the first entity from the first page (e.g. to get first document id).
   */
  getFirstFromList(
    pageSize = 1,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes> | null> {
    return this.getListFirst(pageSize).pipe(firstOrNull());
  }

  getListByDocumentId(
    documentId: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes>[]> {
    return this.getList({
      'filters[documentId][$eq]': documentId,
      ...extraQuery,
    });
  }

  getListFirst(
    pageSize = 1,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes>[]> {
    return this.getList({ 'pagination[pageSize]': pageSize });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthProductAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }

  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthProductAttributes> | null> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthProductAttributes> | null }>(
        path,
        query,
      )
      .pipe(map((r) => r.data ?? null));
  }
}
