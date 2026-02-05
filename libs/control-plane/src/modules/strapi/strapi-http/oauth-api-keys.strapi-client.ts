import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
} from './strapi.types';
import type { StrapiOAuthApiKeyAttributes } from './entities/oauth-api-key.attributes';

/**
 * Strapi client for the oauth-api-keys collection.
 * Exposes GET list (used for API key validation cache).
 */
@Injectable()
export class OAuthApiKeysStrapiClient {

  private readonly COLLECTION = 'oauth-api-keys';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-api-keys with optional populate.
   * @param query - e.g. populate=client.
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthApiKeyAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthApiKeyAttributes>>(
      this.COLLECTION,
      query,
    );
  }
}
