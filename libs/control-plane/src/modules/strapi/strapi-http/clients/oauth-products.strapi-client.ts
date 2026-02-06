import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthProductAttributes } from '../entities/oauth-product.attributes';

/**
 * Strapi client for the oauth-products collection.
 * Exposes GET list, GET by id, and getFirst* helpers.
 */
@Injectable()
export class OAuthProductsStrapiClient {
  private readonly COLLECTION = 'oauth-products';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-product matching documentId, or null.
   */
  async getFirstByDocumentId(
    documentId: string,
  ): Promise<StrapiEntity<StrapiOAuthProductAttributes> | null> {
    const response = await this.getListByDocumentId(documentId);
    return this.responseHelper.pickFirstEntity(response);
  }

  /**
   * Fetches the first entity from the first page (e.g. to get first document id).
   */
  async getFirstFromList(
    pageSize = 1,
  ): Promise<StrapiEntity<StrapiOAuthProductAttributes> | null> {
    const response = await this.getListFirst(pageSize);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getListByDocumentId(
    documentId: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthProductAttributes>> {
    const response = await this.getList({
      'filters[documentId][$eq]': documentId,
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  async getListFirst(
    pageSize = 1,
  ): Promise<StrapiCollectionResponse<StrapiOAuthProductAttributes>> {
    const response = await this.getList({ 'pagination[pageSize]': pageSize });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthProductAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthProductAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }

  async getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthProductAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    const response = await this.client.get<
      StrapiSingleResponse<StrapiOAuthProductAttributes>
    >(path, query);
    return this.validateResponse(response);
  }
}
