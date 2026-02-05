import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from './strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
  StrapiSingleResponse,
} from './strapi.types';
import type { StrapiOAuthProductAttributes } from './entities/oauth-product.attributes';

/**
 * Strapi client for the oauth-products collection.
 * Exposes GET list and GET by id.
 */
@Injectable()
export class OAuthProductsStrapiClient {
  private readonly COLLECTION = 'oauth-products';

  constructor(private readonly client: StrapiHttpClient) {}

  /**
   * Fetches oauth-products with optional filters and pagination.
   * @param query - e.g. filters[documentId][$eq], pagination[pageSize].
   * @returns Collection response.
   */
  getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthProductAttributes>> {
    return this.client.get<StrapiCollectionResponse<StrapiOAuthProductAttributes>>(
      this.COLLECTION,
      query,
    );
  }

  /**
   * Fetches a single oauth-product by document id or numeric id.
   * @param id - Document id or numeric id.
   * @param query - Optional populate/filters.
   * @returns Single response.
   */
  getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthProductAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.get<StrapiSingleResponse<StrapiOAuthProductAttributes>>(
      path,
      query,
    );
  }
}
