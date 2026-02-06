import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthClientAttributes } from '../entities/oauth-client.attributes';

/**
 * Strapi client for the oauth-clients collection.
 * Exposes GET by id, GET list, and POST (create).
 */
/** Default populate query for product, user, and audiences relations. */
const POPULATE_PRODUCT_USER_AUDIENCES: StrapiQueryParams = {
  'populate[0]': 'product',
  'populate[1]': 'user',
  'populate[2]': 'audiences',
};

@Injectable()
export class OAuthClientsStrapiClient {
  private readonly COLLECTION = 'oauth-clients';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Returns the default query params to populate product, user, and audiences.
   * Use with getById or getList when full relation data is needed.
   */
  getPopulateProductUserAudiences(): StrapiQueryParams {
    return { ...POPULATE_PRODUCT_USER_AUDIENCES };
  }

  /**
   * Fetches oauth-clients filtered by clientSecret, with product, user, and audiences populated.
   * @param clientSecret - Client secret to filter by.
   * @param extraQuery - Optional extra query params (e.g. pagination).
   * @returns Collection response.
   */
  async getListByClientSecret(
    clientSecret: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthClientAttributes>> {
    const response = await this.getList({
      'filters[clientSecret][$eq]': clientSecret,
      ...POPULATE_PRODUCT_USER_AUDIENCES,
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  /**
   * Fetches the first oauth-client matching clientSecret, or null.
   */
  async getFirstByClientSecret(
    clientSecret: string,
  ): Promise<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    const response = await this.getListByClientSecret(clientSecret);
    return this.responseHelper.pickFirstEntity(response);
  }

  /**
   * Fetches oauth-clients filtered by numeric id, with product, user, and audiences populated.
   * @param numericId - Numeric (integer) id to filter by.
   * @param extraQuery - Optional extra query params.
   * @returns Collection response.
   */
  async getListByNumericId(
    numericId: number,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthClientAttributes>> {
    const response = await this.getList({
      'filters[id][$eq]': numericId,
      ...POPULATE_PRODUCT_USER_AUDIENCES,
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  /**
   * Fetches the first oauth-client matching numeric id, or null.
   */
  async getFirstByNumericId(
    numericId: number,
  ): Promise<StrapiEntity<StrapiOAuthClientAttributes> | null> {
    const response = await this.getListByNumericId(numericId);
    return this.responseHelper.pickFirstEntity(response);
  }

  /**
   * Fetches oauth-clients filtered by product documentId, with all relations populated.
   * @param productId - Product document id to filter by.
   * @param extraQuery - Optional extra query params.
   * @returns Collection response.
   */
  async getListByProductId(
    productId: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthClientAttributes>> {
    const response = await this.getList({
      'filters[product][documentId][$eq]': productId,
      populate: '*',
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  /**
   * Fetches a single oauth-client by document id or numeric id.
   * @param id - Document id or numeric id.
   * @param query - Optional populate/filters (e.g. populate[0]=product).
   * @returns Single response or null in data.
   */
  async getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    const response = await this.client.get<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      path,
      query,
    );
    return this.validateResponse(response);
  }

  /**
   * Fetches oauth-clients with optional filters and populate.
   * @param query - Filters, populate, pagination (e.g. filters[clientSecret][$eq], populate).
   * @returns Collection response.
   */
  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthClientAttributes>> {
    const response = await this.client.get<StrapiCollectionResponse<StrapiOAuthClientAttributes>>(
      this.COLLECTION,
      query,
    );
    return this.validateResponse(response);
  }

  /**
   * Creates a new oauth-client.
   * @param data - Payload under { data: { ...attributes } }.
   * @returns Created document in single response.
   */
  async create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    const response = await this.client.post<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
    return this.validateResponse(response);
  }

  /**
   * Updates an existing oauth-client by id.
   * @param id - Document id or numeric id.
   * @param data - Payload under { data: { ...attributes } }.
   * @param query - Optional query params.
   * @returns Updated document in single response.
   */
  async put(
    id: string,
    data: { data: Record<string, unknown> },
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthClientAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    const response = await this.client.put<StrapiSingleResponse<StrapiOAuthClientAttributes>>(
      path,
      data,
      query,
    );
    return this.validateResponse(response);
  }
}
