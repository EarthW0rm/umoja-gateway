import { BadGatewayException } from '@nestjs/common';
import { OAuthAudiencesStrapiClient } from './oauth-audiences.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type { StrapiCollectionResponse, StrapiEntity } from '../infra/strapi.types';
import type { StrapiOAuthAudienceAttributes } from '../entities/oauth-audience.attributes';

describe('OAuthAudiencesStrapiClient', () => {
  let client: OAuthAudiencesStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthAudienceAttributes> = {
    data: [{ id: 1, attributes: { value: 'audience-1' } }],
  };
  const firstEntity: StrapiEntity<StrapiOAuthAudienceAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
      pickFirstEntity: jest.fn().mockReturnValue(firstEntity),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthAudiencesStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-audiences',
        query,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(collectionResponse);
    });

    it('throws when responseHelper.ensureNoError throws', async () => {
      (responseHelper.ensureNoError as unknown as jest.Mock).mockImplementation(() => {
        throw new BadGatewayException('Control plane unavailable');
      });

      await expect(client.getList()).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getListByValue', () => {
    it('calls getList with value filter and pageSize 1', async () => {
      const result = await client.getListByValue('audience-1');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-audiences', {
        'filters[value][$eq]': 'audience-1',
        'pagination[pageSize]': 1,
      });
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(collectionResponse);
    });

    it('merges extraQuery into getList params', async () => {
      await client.getListByValue('v', { populate: 'client' });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-audiences', {
        'filters[value][$eq]': 'v',
        'pagination[pageSize]': 1,
        populate: 'client',
      });
    });
  });

  describe('getFirstByValue', () => {
    it('returns first entity from getListByValue', async () => {
      const result = await client.getFirstByValue('audience-1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByValue('audience-1');

      expect(result).toBeNull();
    });
  });
});
