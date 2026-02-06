import { firstValueFrom, of } from 'rxjs';
import { OAuthAudiencesStrapiClient } from './oauth-audiences.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type { StrapiCollectionResponse, StrapiEntity } from '../infra/strapi.types';
import type { StrapiOAuthAudienceAttributes } from '../entities/oauth-audience.attributes';

describe('OAuthAudiencesStrapiClient', () => {
  let client: OAuthAudiencesStrapiClient;
  let strapiClient: StrapiHttpClient;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthAudienceAttributes> = {
    data: [{ id: 1, attributes: { value: 'audience-1' } }],
  };
  const firstEntity: StrapiEntity<StrapiOAuthAudienceAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockReturnValue(of(collectionResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthAudiencesStrapiClient(strapiClient);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-audiences',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListByValue', () => {
    it('calls getList with value filter and pageSize 1', async () => {
      const result = await firstValueFrom(client.getListByValue('audience-1'));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-audiences', {
        'filters[value][$eq]': 'audience-1',
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('merges extraQuery into getList params', async () => {
      await firstValueFrom(client.getListByValue('v', { populate: 'client' }));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-audiences', {
        'filters[value][$eq]': 'v',
        'pagination[pageSize]': 1,
        populate: 'client',
      });
    });
  });

  describe('getFirstByValue', () => {
    it('returns first entity from getListByValue', async () => {
      const result = await firstValueFrom(client.getFirstByValue('audience-1'));

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(client.getFirstByValue('audience-1'));

      expect(result).toBeNull();
    });
  });
});
