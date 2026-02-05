import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiOAuthTokenAttributes } from './entities/oauth-token.attributes';

/**
 * Strapi client for the oauth-tokens collection.
 * Exposes GET list and POST (create).
 */
@Injectable()
export class OAuthTokensStrapiClient {
  private readonly COLLECTION = 'oauth-tokens';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-tokens with optional filters and populate.
   * @param query - e.g. filters[accessToken][$eq], populate.
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthTokenAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthTokenAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Creates a new oauth-token.
   * @param data - Payload { data: { accessToken, accessTokenExpiresAt, scope, client, user, ... } }.
   * @returns Created document in single response.
   */
  create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthTokenAttributes>> {
    return this.client.post<StrapiSingleResponse<StrapiOAuthTokenAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
  }
}
