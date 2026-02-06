import { BadGatewayException } from '@nestjs/common';
import { OAuthTokensStrapiClient } from './oauth-tokens.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthTokenAttributes } from '../entities/oauth-token.attributes';

describe('OAuthTokensStrapiClient', () => {
  let client: OAuthTokensStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthTokenAttributes> = {
    data: [
      {
        id: 1,
        attributes: {
          accessToken: 'at-1',
          accessTokenExpiresAt: '2025-01-01T00:00:00Z',
        },
      },
    ],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthTokenAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthTokenAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
      post: jest.fn().mockResolvedValue(singleResponse),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
      pickFirstEntity: jest.fn().mockReturnValue(firstEntity),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthTokensStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-tokens',
        query,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(collectionResponse);
    });

    it('throws when ensureNoError throws', async () => {
      (responseHelper.ensureNoError as unknown as jest.Mock).mockImplementation(() => {
        throw new BadGatewayException('Control plane unavailable');
      });

      await expect(client.getList()).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getListByAccessToken', () => {
    it('calls getList with accessToken filter and populate *', async () => {
      const result = await client.getListByAccessToken('at-1');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-tokens', {
        'filters[accessToken][$eq]': 'at-1',
        populate: '*',
      });
      expect(result).toEqual(collectionResponse);
    });

    it('merges extraQuery', async () => {
      await client.getListByAccessToken('at-1', { 'pagination[pageSize]': 1 });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-tokens', {
        'filters[accessToken][$eq]': 'at-1',
        populate: '*',
        'pagination[pageSize]': 1,
      });
    });
  });

  describe('getFirstByAccessToken', () => {
    it('returns first entity from getListByAccessToken', async () => {
      const result = await client.getFirstByAccessToken('at-1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByAccessToken('at-1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { accessToken: 'new-at' } };
      const result = await client.create(data);

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-tokens',
        data,
        undefined,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });
  });
});
