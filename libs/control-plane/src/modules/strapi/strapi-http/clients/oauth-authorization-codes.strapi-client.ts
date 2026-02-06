import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthAuthorizationCodeAttributes } from '../entities/oauth-authorization-code.attributes';

/**
 * Strapi client for the oauth-authorization-codes collection.
 * Exposes GET list, POST (create), DELETE by id, and getFirst* helpers.
 */
@Injectable()
export class OAuthAuthorizationCodesStrapiClient {
  private readonly COLLECTION = 'oauth-authorization-codes';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-authorization-code matching code, or null.
   * @param options.populate - When true, populates all relations.
   */
  async getFirstByAuthorizationCode(
    code: string,
    options?: { populate?: boolean },
  ): Promise<StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> | null> {
    const response = await this.getListByAuthorizationCode(code, options);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getListByAuthorizationCode(
    code: string,
    options?: { populate?: boolean },
  ): Promise<StrapiCollectionResponse<StrapiOAuthAuthorizationCodeAttributes>> {
    const response = await this.getList({
      'filters[authorizationCode][$eq]': code,
      ...(options?.populate && { populate: '*' }),
    });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthAuthorizationCodeAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthAuthorizationCodeAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }

  async create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthAuthorizationCodeAttributes>> {
    const response = await this.client.post<
      StrapiSingleResponse<StrapiOAuthAuthorizationCodeAttributes>
    >(this.COLLECTION, data, undefined);
    return this.validateResponse(response);
  }

  deleteById(id: string): Promise<unknown> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.delete<unknown>(path, undefined);
  }
}
