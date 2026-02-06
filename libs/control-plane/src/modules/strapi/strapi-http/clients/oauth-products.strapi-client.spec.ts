import { firstValueFrom, of } from 'rxjs';
import { OAuthProductsStrapiClient } from './oauth-products.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthProductAttributes } from '../entities/oauth-product.attributes';

describe('OAuthProductsStrapiClient', () => {
  let client: OAuthProductsStrapiClient;
  let strapiClient: StrapiHttpClient;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthProductAttributes> = {
    data: [{ id: 1, documentId: 'prod-1', attributes: { name: 'Product 1' } }],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthProductAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthProductAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockReturnValue(of(collectionResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthProductsStrapiClient(strapiClient);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-products',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListFirst', () => {
    it('calls getList with default pageSize 1', async () => {
      const result = await firstValueFrom(client.getListFirst());

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('calls getList with custom pageSize', async () => {
      await firstValueFrom(client.getListFirst(10));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 10,
      });
    });
  });

  describe('getListByDocumentId', () => {
    it('calls getList with documentId filter', async () => {
      const result = await firstValueFrom(
        client.getListByDocumentId('prod-doc-id'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'filters[documentId][$eq]': 'prod-doc-id',
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('merges extraQuery', async () => {
      await firstValueFrom(
        client.getListByDocumentId('id', { populate: 'clients' }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'filters[documentId][$eq]': 'id',
        populate: 'clients',
      });
    });
  });

  describe('getFirstByDocumentId', () => {
    it('returns first entity from getListByDocumentId', async () => {
      const result = await firstValueFrom(
        client.getFirstByDocumentId('prod-1'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByDocumentId('prod-1'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getFirstFromList', () => {
    it('returns first entity from getListFirst with default pageSize', async () => {
      const result = await firstValueFrom(client.getFirstFromList());

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(firstEntity);
    });

    it('uses custom pageSize', async () => {
      await firstValueFrom(client.getFirstFromList(5));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-products', {
        'pagination[pageSize]': 5,
      });
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      const result = await firstValueFrom(
        client.getById('doc-123', { populate: 'clients' }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-products/doc-123',
        { populate: 'clients' },
      );
      expect(result).toEqual(singleResponse.data);
    });

    it('encodes id in path', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      await firstValueFrom(client.getById('id/with/slash'));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-products/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });
});
