import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiAuthorizationCodeAttributes } from './entities/oauth-authorization-code.attributes';

/**
 * Strapi client for the oauth-authorization-codes collection.
 * Exposes GET list, POST (create), and DELETE by id.
 */
@Injectable()
export class OAuthAuthorizationCodesStrapiClient {
  private readonly COLLECTION = 'oauth-authorization-codes';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-authorization-codes with optional filters and populate.
   * @param query - e.g. filters[authorizationCode][$eq], populate.
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiAuthorizationCodeAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiAuthorizationCodeAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Creates a new oauth-authorization-code.
   * @param data - Payload { data: { authorizationCode, expiresAt, redirectUri, scope, client, user, ... } }.
   * @returns Created document in single response.
   */
  create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiAuthorizationCodeAttributes>> {
    return this.client.post<StrapiSingleResponse<StrapiAuthorizationCodeAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
  }

  /**
   * Deletes an oauth-authorization-code by document id or numeric id.
   * @param id - Document id or numeric id.
   * @returns Strapi delete response.
   */
  deleteById(id: string): Promise<unknown> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.delete<unknown>(path, undefined);
  }
}
