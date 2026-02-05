import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiOAuthUserAttributes } from './entities/oauth-user.attributes';

/**
 * Strapi client for the oauth-users collection.
 * Exposes GET by id, GET list, and POST (create).
 */
@Injectable()
export class OAuthUsersStrapiClient {
  private readonly COLLECTION = 'oauth-users';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches a single oauth-user by document id or numeric id.
   * @param id - Document id or numeric id.
   * @param query - Optional populate (e.g. populate=audiences).
   * @returns Single response.
   */
  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.get<StrapiSingleResponse<StrapiOAuthUserAttributes>>(
      path,
      query,
    );
  }

  /**
   * Fetches oauth-users with optional filters, populate, and pagination.
   * @param query - e.g. filters[username][$eq], filters[password][$eq], populate.
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthUserAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthUserAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Creates a new oauth-user.
   * @param data - Payload { data: { username, password, audiences? } }.
   * @returns Created document in single response.
   */
  create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    return this.client.post<StrapiSingleResponse<StrapiOAuthUserAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
  }

  /**
   * Updates an existing oauth-user by id.
   * @param id - Document id or numeric id.
   * @param data - Payload { data: { ...attributes } }.
   * @param query - Optional query params.
   * @returns Updated document in single response.
   */
  put(
    id: string,
    data: { data: Record<string, unknown> },
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.put<StrapiSingleResponse<StrapiOAuthUserAttributes>>(
      path,
      data,
      query,
    );
  }
}
