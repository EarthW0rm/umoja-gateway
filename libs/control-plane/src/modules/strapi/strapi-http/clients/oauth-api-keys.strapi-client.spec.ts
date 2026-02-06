import { BadGatewayException } from '@nestjs/common';
import { OAuthApiKeysStrapiClient } from './oauth-api-keys.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type { StrapiCollectionResponse } from '../infra/strapi.types';
import type { StrapiOAuthApiKeyAttributes } from '../entities/oauth-api-key.attributes';

describe('OAuthApiKeysStrapiClient', () => {
  let client: OAuthApiKeysStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthApiKeyAttributes> = {
    data: [{ id: 1, attributes: { apiKey: 'key-1' } }],
  };

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthApiKeysStrapiClient(
      strapiClient as unknown as StrapiHttpClient,
      responseHelper as unknown as StrapiResponseHelperService,
    );
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { 'pagination[pageSize]': 10 };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        query,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(collectionResponse);
    });

    it('calls client.get without query when undefined', async () => {
      await client.getList();

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        undefined,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
    });

    it('throws when responseHelper.ensureNoError throws', async () => {
      (responseHelper.ensureNoError as unknown as jest.Mock).mockImplementation(() => {
        throw new BadGatewayException('Control plane unavailable');
      });

      await expect(client.getList()).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getListWithClientPopulate', () => {
    it('calls getList with populate client and optional extra query', async () => {
      const extraQuery = { 'pagination[pageSize]': 5 };
      const result = await client.getListWithClientPopulate(extraQuery);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        { populate: 'client', ...extraQuery },
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(collectionResponse);
    });

    it('calls getList with only populate client when no extra query', async () => {
      await client.getListWithClientPopulate();

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        { populate: 'client' },
      );
    });
  });
});
