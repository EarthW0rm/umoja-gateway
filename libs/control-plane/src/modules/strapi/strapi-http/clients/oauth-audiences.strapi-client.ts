import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthAudienceAttributes } from '../entities/oauth-audience.attributes';

/**
 * Strapi client for the oauth-audiences collection.
 * Exposes GET list and getFirst* helpers.
 */
@Injectable()
export class OAuthAudiencesStrapiClient {
  private readonly COLLECTION = 'oauth-audiences';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-audience matching value, or null.
   */
  async getFirstByValue(
    value: string,
  ): Promise<StrapiEntity<StrapiOAuthAudienceAttributes> | null> {
    const response = await this.getListByValue(value);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getListByValue(
    value: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthAudienceAttributes>> {
    const response = await this.getList({
      'filters[value][$eq]': value,
      'pagination[pageSize]': 1,
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthAudienceAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthAudienceAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }
}
