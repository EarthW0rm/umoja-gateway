import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiQueryParams,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthRefreshTokenAttributes } from '../entities/oauth-refresh-token.attributes';

/**
 * Strapi client for the oauth-refresh-tokens collection.
 * Exposes GET list, POST (create), DELETE by id, and getFirst* helpers.
 */
@Injectable()
export class OAuthRefreshTokensStrapiClient {
  private readonly COLLECTION = 'oauth-refresh-tokens';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  /**
   * Fetches the first oauth-refresh-token matching refreshToken, or null.
   * @param options.populate - When true, populates all relations.
   */
  async getFirstByRefreshToken(
    refreshToken: string,
    options?: { populate?: boolean },
  ): Promise<StrapiEntity<StrapiOAuthRefreshTokenAttributes> | null> {
    const response = await this.getListByRefreshToken(refreshToken, options);
    return this.responseHelper.pickFirstEntity(response);
  }

  async getListByRefreshToken(
    refreshToken: string,
    options?: { populate?: boolean },
  ): Promise<StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes>> {
    const response = await this.getList({
      'filters[refreshToken][$eq]': refreshToken,
      ...(options?.populate && { populate: '*' }),
    });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }

  async create(
    data: { data: Record<string, unknown> },
  ): Promise<StrapiSingleResponse<StrapiOAuthRefreshTokenAttributes>> {
    const response = await this.client.post<
      StrapiSingleResponse<StrapiOAuthRefreshTokenAttributes>
    >(this.COLLECTION, data, undefined);
    return this.validateResponse(response);
  }

  deleteById(id: string): Promise<unknown> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.delete<unknown>(path, undefined);
  }
}
