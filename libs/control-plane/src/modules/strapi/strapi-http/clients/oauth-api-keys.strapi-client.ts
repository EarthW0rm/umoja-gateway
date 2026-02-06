import { Injectable } from '@nestjs/common';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthApiKeyAttributes } from '../entities/oauth-api-key.attributes';

/**
 * Strapi client for the oauth-api-keys collection.
 * Exposes GET list (e.g. for API key validation cache).
 */
@Injectable()
export class OAuthApiKeysStrapiClient {
  private readonly COLLECTION = 'oauth-api-keys';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly responseHelper: StrapiResponseHelperService,
  ) {}

  private validateResponse<T extends { error?: unknown }>(response: T): T {
    return this.responseHelper.ensureNoError(response);
  }

  async getListWithClientPopulate(
    extraQuery?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthApiKeyAttributes>> {
    const response = await this.getList({ populate: 'client', ...extraQuery });
    return this.validateResponse(response);
  }

  async getList(
    query?: StrapiQueryParams,
  ): Promise<StrapiCollectionResponse<StrapiOAuthApiKeyAttributes>> {
    const response = await this.client.get<
      StrapiCollectionResponse<StrapiOAuthApiKeyAttributes>
    >(this.COLLECTION, query);
    return this.validateResponse(response);
  }
}
