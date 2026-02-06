import { firstValueFrom, of } from 'rxjs';
import { OAuthTokensStrapiClient } from './oauth-tokens.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthTokenAttributes } from '../entities/oauth-token.attributes';

describe('OAuthTokensStrapiClient', () => {
  let client: OAuthTokensStrapiClient;
  let strapiClient: StrapiHttpClient;

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
      get: jest.fn().mockReturnValue(of(collectionResponse)),
      post: jest.fn().mockReturnValue(of(singleResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthTokensStrapiClient(strapiClient);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-tokens',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListByAccessToken', () => {
    it('calls getList with accessToken filter and populate *', async () => {
      const result = await firstValueFrom(client.getListByAccessToken('at-1'));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-tokens', {
        'filters[accessToken][$eq]': 'at-1',
        populate: '*',
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('merges extraQuery', async () => {
      await firstValueFrom(
        client.getListByAccessToken('at-1', { 'pagination[pageSize]': 1 }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-tokens', {
        'filters[accessToken][$eq]': 'at-1',
        populate: '*',
        'pagination[pageSize]': 1,
      });
    });
  });

  describe('getFirstByAccessToken', () => {
    it('returns first entity from getListByAccessToken', async () => {
      const result = await firstValueFrom(
        client.getFirstByAccessToken('at-1'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByAccessToken('at-1'),
      );

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { accessToken: 'new-at' } };
      const result = await firstValueFrom(client.create(data));

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-tokens',
        data,
        undefined,
      );
      expect(result).toEqual(singleResponse.data);
    });
  });
});
