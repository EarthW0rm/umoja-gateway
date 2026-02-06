import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthTokenAttributes } from '../entities/oauth-token.attributes';

/**
 * Strapi client for the oauth-tokens collection.
 * Exposes GET list, POST (create), and getFirst* helpers.
 */
@Injectable()
export class OAuthTokensStrapiClient {
  private readonly COLLECTION = 'oauth-tokens';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-token matching accessToken, or null.
   */
  async getFirstByAccessToken(
    accessToken: string,
  ): Promise<StrapiEntity<StrapiOAuthTokenAttributes> | null> {
    const response = await this.getListByAccessToken(accessToken);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getListByAccessToken(
    accessToken: string,
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthTokenAttributes>> {
    const response = await this.getList({
      'filters[accessToken][$eq]': accessToken,
      populate: '*',
      ...extraQuery,
    });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthTokenAttributes>> {
    const response = await this.client.get<StrapiCollectionResponse<StrapiOAuthTokenAttributes>>(
      this.COLLECTION,
      query,
    );
    return this.validateResponse(response);
  }

  async create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthTokenAttributes>> {
    const response = await this.client.post<StrapiSingleResponse<StrapiOAuthTokenAttributes>>(
      this.COLLECTION,
      data,
      undefined,
    );
    return this.validateResponse(response);
  }
}
