import { BadGatewayException } from '@nestjs/common';
import { OAuthClientsStrapiClient } from './oauth-clients.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthClientAttributes } from '../entities/oauth-client.attributes';

describe('OAuthClientsStrapiClient', () => {
  let client: OAuthClientsStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthClientAttributes> = {
    data: [
      {
        id: 1,
        documentId: 'doc-1',
        attributes: {
          clientSecret: 'secret',
          redirectUris: [],
          grants: ['password'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        },
      },
    ],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthClientAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthClientAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
      post: jest.fn().mockResolvedValue(singleResponse),
      put: jest.fn().mockResolvedValue(singleResponse),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
      pickFirstEntity: jest.fn().mockReturnValue(firstEntity),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthClientsStrapiClient(strapiClient, responseHelper);
  });

  describe('getPopulateProductUserAudiences', () => {
    it('returns copy of default populate params', () => {
      const result = client.getPopulateProductUserAudiences();

      expect(result).toEqual({
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
      });
      expect(result).not.toBe(client.getPopulateProductUserAudiences());
    });
  });

  describe('getList', () => {
    it('calls client.get with collection and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients',
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

  describe('getListByClientSecret', () => {
    it('calls getList with clientSecret filter and populate', async () => {
      const result = await client.getListByClientSecret('my-secret');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[clientSecret][$eq]': 'my-secret',
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
      });
      expect(result).toEqual(collectionResponse);
    });

    it('merges extraQuery', async () => {
      await client.getListByClientSecret('s', { 'pagination[pageSize]': 1 });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[clientSecret][$eq]': 's',
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
        'pagination[pageSize]': 1,
      });
    });
  });

  describe('getFirstByClientSecret', () => {
    it('returns first entity from getListByClientSecret', async () => {
      const result = await client.getFirstByClientSecret('secret');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByClientSecret('secret');

      expect(result).toBeNull();
    });
  });

  describe('getListByNumericId', () => {
    it('calls getList with id filter and populate', async () => {
      const result = await client.getListByNumericId(42);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[id][$eq]': 42,
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
      });
      expect(result).toEqual(collectionResponse);
    });
  });

  describe('getFirstByNumericId', () => {
    it('returns first entity from getListByNumericId', async () => {
      const result = await client.getFirstByNumericId(42);

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });
  });

  describe('getListByProductId', () => {
    it('calls getList with product documentId filter and populate *', async () => {
      const result = await client.getListByProductId('product-doc-id');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[product][documentId][$eq]': 'product-doc-id',
        populate: '*',
      });
      expect(result).toEqual(collectionResponse);
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockResolvedValue(singleResponse);

      const result = await client.getById('doc-123', { populate: 'product' });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients/doc-123',
        { populate: 'product' },
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });

    it('encodes id in path', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockResolvedValue(singleResponse);

      await client.getById('id/with/slash');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { clientSecret: 'new-secret' } };
      const result = await client.create(data);

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-clients',
        data,
        undefined,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });
  });

  describe('put', () => {
    it('calls client.put with collection/id path, data and query', async () => {
      const data = { data: { clientSecret: 'updated' } };
      const result = await client.put('doc-456', data, { populate: '*' });

      expect((strapiClient as unknown as { put: jest.Mock }).put).toHaveBeenCalledWith(
        'oauth-clients/doc-456',
        data,
        { populate: '*' },
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });
  });
});
