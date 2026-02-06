import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { toDataArray } from '../infra/operators';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthApiKeyAttributes } from '../entities/oauth-api-key.attributes';

/**
 * Strapi client for the oauth-api-keys collection.
 * Exposes GET list (e.g. for API key validation cache).
 * Non-2xx responses are already turned into exceptions by StrapiHttpClient.
 */
@Injectable()
export class OAuthApiKeysStrapiClient {
  private readonly COLLECTION = 'oauth-api-keys';

  constructor(private readonly client: StrapiHttpClient) {}

  getListWithClientPopulate(
    extraQuery?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthApiKeyAttributes>[]> {
    return this.getList({ populate: 'client', ...extraQuery });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthApiKeyAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthApiKeyAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }
}
