import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthUserAttributes } from '../entities/oauth-user.attributes';

/**
 * Strapi client for the oauth-users collection.
 * Exposes GET by id, GET list, POST (create), PUT, and getFirst* helpers.
 */
@Injectable()
export class OAuthUsersStrapiClient {
  private readonly COLLECTION = 'oauth-users';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-user from the first page (e.g. to get first document id).
   */
  async getFirstFromList(
    pageSize = 1,
  ): Promise<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    const response = await this.getListFirst(pageSize);
    return this.responseHelper.pickFirstEntity(response);
  }

  /**
   * Fetches the first oauth-user matching username and password, or null.
   */
  async getFirstByCredentials(
    username: string,
    password: string,
  ): Promise<StrapiEntity<StrapiOAuthUserAttributes> | null> {
    const response = await this.getListByCredentials(username, password);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getById(
    id: string,
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    const response = await this.client.get<
      StrapiSingleResponse<StrapiOAuthUserAttributes>
    >(path, query);
    return this.validateResponse(response);
  }

  async getListFirst(
    pageSize = 1,
  ): Promise<StrapiCollectionResponse<StrapiOAuthUserAttributes>> {
    const response = await this.getList({ 'pagination[pageSize]': pageSize });
    return this.validateResponse(response);
  }

  async getByIdWithAudiences(
    userId: string,
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    return this.getById(userId, { populate: 'audiences' });
  }

  async getListByCredentials(
    username: string,
    password: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthUserAttributes>> {
    const response = await this.getList({
      'filters[username][$eq]': username,
      'filters[password][$eq]': password,
      populate: 'audiences',
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthUserAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthUserAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }

  async create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    const response = await this.client.post<
      StrapiSingleResponse<StrapiOAuthUserAttributes>
    >(this.COLLECTION, data, undefined);
    return this.validateResponse(response);
  }

  async put(
    id: string,
    data: { data: Record<string, unknown> },
    query?: StrapiQueryParams,
  ): Promise<StrapiSingleResponse<StrapiOAuthUserAttributes>> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    const response = await this.client.put<
      StrapiSingleResponse<StrapiOAuthUserAttributes>
    >(path, data, query);
    return this.validateResponse(response);
  }
}
