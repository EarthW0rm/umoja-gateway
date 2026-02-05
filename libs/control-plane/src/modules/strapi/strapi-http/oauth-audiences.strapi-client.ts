import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
} from './strapi.types';
import type { StrapiAudienceAttributes } from './entities/oauth-audience.attributes';

/**
 * Strapi client for the oauth-audiences collection.
 * Exposes GET list (read-only from OAuth flow perspective).
 */
@Injectable()
export class OAuthAudiencesStrapiClient {
  private readonly COLLECTION = 'oauth-audiences';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-audiences with optional filters and pagination.
   * @param query - e.g. filters[value][$eq], pagination[pageSize].
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiAudienceAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiAudienceAttributes>>(
      this.COLLECTION,
      query,
    );
  }
}
