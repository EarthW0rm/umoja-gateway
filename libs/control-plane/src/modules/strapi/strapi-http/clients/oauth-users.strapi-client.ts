import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthUserAttributes } from '../entities/oauth-user.attributes';

/**
 * Strapi client for the oauth-users collection.
 * Exposes GET by id, GET list, POST (create), PUT, and getFirst* helpers.
 */
@Injectable()
export class OAuthUsersStrapiClient {
  private readonly COLLECTION = 'oauth-users';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches the first oauth-user from the first page (e.g. to get first document id).
   */
  getFirstFromList(
    pageSize = 1,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    return this.getListFirst(pageSize).pipe(firstOrNull());
  }

  /**
   * Fetches the first oauth-user matching username and password, or null.
   */
  getFirstByCredentials(
    username: string,
    password: string,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    return this.getListByCredentials(username, password).pipe(firstOrNull());
  }

  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthUserAttributes> | null }>(path, query)
      .pipe(map((r) => r.data ?? null));
  }

  getListFirst(
    pageSize = 1,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes>[]> {
    return this.getList({ 'pagination[pageSize]': pageSize });
  }

  getByIdWithAudiences(
    userId: string,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    return this.getById(userId, { populate: 'audiences' });
  }

  getListByCredentials(
    username: string,
    password: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes>[]> {
    return this.getList({
      'filters[username][$eq]': username,
      'filters[password][$eq]': password,
      populate: 'audiences',
      ...extraQuery,
    });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthUserAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }

  create(
    data: { data: Record<string, unknown> },
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    return this.client
      .post<{ data: StrapiEntity<StrapiOAuthUserAttributes> | null }>(
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
  ): Observable<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client
      .put<{ data: StrapiEntity<StrapiOAuthUserAttributes> | null }>(
        path,
        data,
        query,
      )
      .pipe(map((r) => r.data ?? null));
  }
}
