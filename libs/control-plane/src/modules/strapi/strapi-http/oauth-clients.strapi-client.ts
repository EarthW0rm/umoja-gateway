import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiOAuthClientAttributes } from './entities/oauth-client.attributes';

/**
 * Strapi client for the oauth-clients collection.
 * Exposes GET by id, GET list, and POST (create).
 */
@Injectable()
export class OAuthClientsStrapiClient {
  private readonly COLLECTION = 'oauth-clients';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches a single oauth-client by document id or numeric id.
   * @param id - Document id or numeric id.
   * @param query - Optional populate/filters (e.g. populate[0]=product).
   * @returns Single response or null in data.
   */
  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.get<StrapiSingleResponse<StrapiOAuthClientAttributes>>(path, query);
  }

  /**
   * Fetches oauth-clients with optional filters and populate.
   * @param query - Filters, populate, pagination (e.g. filters[clientSecret][$eq], populate).
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthClientAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthClientAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Creates a new oauth-client.
   * @param data - Payload under { data: { ...attributes } }.
   * @returns Created document in single response.
   */
  create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    return this.client.post<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
  }

  /**
   * Updates an existing oauth-client by id.
   * @param id - Document id or numeric id.
   * @param data - Payload under { data: { ...attributes } }.
   * @param query - Optional query params.
   * @returns Updated document in single response.
   */
  put(
    id: string,
    data: { data: Record<string, unknown> },
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.put<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      path,
      data,
      query,
    );
  }
}
