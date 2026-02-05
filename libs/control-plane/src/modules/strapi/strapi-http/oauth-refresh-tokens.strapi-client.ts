import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiOAuthRefreshTokenAttributes } from './entities/oauth-refresh-token.attributes';

/**
 * Strapi client for the oauth-refresh-tokens collection.
 * Exposes GET list, POST (create), and DELETE by id.
 */
@Injectable()
export class OAuthRefreshTokensStrapiClient {
  private readonly COLLECTION = 'oauth-refresh-tokens';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-refresh-tokens with optional filters and populate.
   * @param query - e.g. filters[refreshToken][$eq], populate.
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Creates a new oauth-refresh-token.
   * @param data - Payload { data: { refreshToken, refreshTokenExpiresAt, scope, client, user } }.
   * @returns Created document in single response.
   */
  create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthRefreshTokenAttributes>> {
    return this.client.post<StrapiSingleResponse<StrapiOAuthRefreshTokenAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
  }

  /**
   * Deletes an oauth-refresh-token by document id or numeric id.
   * @param id - Document id or numeric id.
   * @returns Strapi delete response.
   */
  deleteById(id: string): Promise<unknown> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.delete<unknown>(path, undefined);
  }
}
