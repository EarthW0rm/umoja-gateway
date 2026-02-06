import { firstValueFrom, of } from 'rxjs';
import { OAuthApiKeysStrapiClient } from './oauth-api-keys.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type { StrapiCollectionResponse } from '../infra/strapi.types';
import type { StrapiOAuthApiKeyAttributes } from '../entities/oauth-api-key.attributes';

describe('OAuthApiKeysStrapiClient', () => {
  let client: OAuthApiKeysStrapiClient;
  let strapiClient: StrapiHttpClient;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthApiKeyAttributes> = {
    data: [{ id: 1, attributes: { apiKey: 'key-1' } }],
  };

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockReturnValue(of(collectionResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthApiKeysStrapiClient(strapiClient);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { 'pagination[pageSize]': 10 };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });

    it('calls client.get without query when undefined', async () => {
      const result = await firstValueFrom(client.getList());

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        undefined,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListWithClientPopulate', () => {
    it('calls getList with populate client and optional extra query', async () => {
      const extraQuery = { 'pagination[pageSize]': 5 };
      const result = await firstValueFrom(
        client.getListWithClientPopulate(extraQuery),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        { populate: 'client', ...extraQuery },
      );
      expect(result).toEqual(collectionResponse.data);
    });

    it('calls getList with only populate client when no extra query', async () => {
      const result = await firstValueFrom(client.getListWithClientPopulate());

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-api-keys',
        { populate: 'client' },
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });
});
