import { firstValueFrom, of } from 'rxjs';
import { OAuthClientsStrapiClient } from './oauth-clients.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthClientAttributes } from '../entities/oauth-client.attributes';

describe('OAuthClientsStrapiClient', () => {
  let client: OAuthClientsStrapiClient;
  let strapiClient: StrapiHttpClient;

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
      get: jest.fn().mockReturnValue(of(collectionResponse)),
      post: jest.fn().mockReturnValue(of(singleResponse)),
      put: jest.fn().mockReturnValue(of(singleResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthClientsStrapiClient(strapiClient);
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
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListByClientSecret', () => {
    it('calls getList with clientSecret filter and populate', async () => {
      const result = await firstValueFrom(
        client.getListByClientSecret('my-secret'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[clientSecret][$eq]': 'my-secret',
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('merges extraQuery', async () => {
      await firstValueFrom(
        client.getListByClientSecret('s', { 'pagination[pageSize]': 1 }),
      );

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
      const result = await firstValueFrom(
        client.getFirstByClientSecret('secret'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByClientSecret('secret'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getListByNumericId', () => {
    it('calls getList with id filter and populate', async () => {
      const result = await firstValueFrom(client.getListByNumericId(42));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[id][$eq]': 42,
        'populate[0]': 'product',
        'populate[1]': 'user',
        'populate[2]': 'audiences',
      });
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getFirstByNumericId', () => {
    it('returns first entity from getListByNumericId', async () => {
      const result = await firstValueFrom(client.getFirstByNumericId(42));

      expect(result).toEqual(firstEntity);
    });
  });

  describe('getListByProductId', () => {
    it('calls getList with product documentId filter and populate *', async () => {
      const result = await firstValueFrom(
        client.getListByProductId('product-doc-id'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-clients', {
        'filters[product][documentId][$eq]': 'product-doc-id',
        populate: '*',
      });
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      const result = await firstValueFrom(
        client.getById('doc-123', { populate: 'product' }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients/doc-123',
        { populate: 'product' },
      );
      expect(result).toEqual(singleResponse.data);
    });

    it('encodes id in path', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      await firstValueFrom(client.getById('id/with/slash'));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-clients/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { clientSecret: 'new-secret' } };
      const result = await firstValueFrom(client.create(data));

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-clients',
        data,
        undefined,
      );
      expect(result).toEqual(singleResponse.data);
    });
  });

  describe('put', () => {
    it('calls client.put with collection/id path, data and query', async () => {
      const data = { data: { clientSecret: 'updated' } };
      const result = await firstValueFrom(
        client.put('doc-456', data, { populate: '*' }),
      );

      expect((strapiClient as unknown as { put: jest.Mock }).put).toHaveBeenCalledWith(
        'oauth-clients/doc-456',
        data,
        { populate: '*' },
      );
      expect(result).toEqual(singleResponse.data);
    });
  });
});
