import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type { StrapiEntity, StrapiQueryParams } from '../infra/strapi.types';
import type { StrapiOAuthAudienceAttributes } from '../entities/oauth-audience.attributes';

/**
 * Strapi client for the oauth-audiences collection.
 * Exposes GET list and getFirst* helpers.
 */
@Injectable()
export class OAuthAudiencesStrapiClient {
  private readonly COLLECTION = 'oauth-audiences';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches the first oauth-audience matching value, or null.
   */
  getFirstByValue(
    value: string,
  ): Observable<StrapiEntity<StrapiOAuthAudienceAttributes> | null> {
    return this.getListByValue(value).pipe(firstOrNull());
  }

  getListByValue(
    value: string,
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthAudienceAttributes>[]> {
    return this.getList({
      'filters[value][$eq]': value,
      'pagination[pageSize]': 1,
      ...extraQuery,
    });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthAudienceAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthAudienceAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }
}
