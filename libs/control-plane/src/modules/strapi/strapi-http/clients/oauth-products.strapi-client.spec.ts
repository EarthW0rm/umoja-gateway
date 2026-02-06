import { BadGatewayException } from '@nestjs/common';
import { OAuthProductsStrapiClient } from './oauth-products.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthProductAttributes } from '../entities/oauth-product.attributes';

describe('OAuthProductsStrapiClient', () => {
  let client: OAuthProductsStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthProductAttributes> = {
    data: [{ id: 1, documentId: 'prod-1', attributes: { name: 'Product 1' } }],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthProductAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthProductAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
      pickFirstEntity: jest.fn().mockReturnValue(firstEntity),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthProductsStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-products',
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

  describe('getListFirst', () => {
    it('calls getList with default pageSize 1', async () => {
      const result = await client.getListFirst();

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(collectionResponse);
    });

    it('calls getList with custom pageSize', async () => {
      await client.getListFirst(10);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 10,
      });
    });
  });

  describe('getListByDocumentId', () => {
    it('calls getList with documentId filter', async () => {
      const result = await client.getListByDocumentId('prod-doc-id');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'filters[documentId][$eq]': 'prod-doc-id',
      });
      expect(result).toEqual(collectionResponse);
    });

    it('merges extraQuery', async () => {
      await client.getListByDocumentId('id', { populate: 'clients' });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'filters[documentId][$eq]': 'id',
        populate: 'clients',
      });
    });
  });

  describe('getFirstByDocumentId', () => {
    it('returns first entity from getListByDocumentId', async () => {
      const result = await client.getFirstByDocumentId('prod-1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByDocumentId('prod-1');

      expect(result).toBeNull();
    });
  });

  describe('getFirstFromList', () => {
    it('returns first entity from getListFirst with default pageSize', async () => {
      const result = await client.getFirstFromList();

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 1,
      });
      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('uses custom pageSize', async () => {
      await client.getFirstFromList(5);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 5,
      });
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockResolvedValue(singleResponse);

      const result = await client.getById('doc-123', { populate: 'clients' });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-products/doc-123',
        { populate: 'clients' },
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
        'oauth-products/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });
});
