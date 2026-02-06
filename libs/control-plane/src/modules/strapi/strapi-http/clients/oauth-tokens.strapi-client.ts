import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthTokenAttributes } from '../entities/oauth-token.attributes';

/**
 * Strapi client for the oauth-tokens collection.
 * Exposes GET list, POST (create), and getFirst* helpers.
 */
@Injectable()
export class OAuthTokensStrapiClient {
  private readonly COLLECTION = 'oauth-tokens';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches the first oauth-token matching accessToken, or null.
   */
  getFirstByAccessToken(
    accessToken: string,
  ): Observable<StrapiEntity<StrapiOAuthTokenAttributes> | null> {
    return this.getListByAccessToken(accessToken).pipe(firstOrNull());
  }

  getListByAccessToken(
    accessToken: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthTokenAttributes>[]> {
    return this.getList({
      'filters[accessToken][$eq]': accessToken,
      populate: '*',
      ...extraQuery,
    });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthTokenAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthTokenAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }

  create(
    data: { data: Record<string, unknown> },
  ): Observable<StrapiEntity<StrapiOAuthTokenAttributes> | null> {
    return this.client
      .post<{ data: StrapiEntity<StrapiOAuthTokenAttributes> | null }>(
        this.COLLECTION,
        data,
        undefined,
      )
      .pipe(map((r) => r.data ?? null));
  }
}
