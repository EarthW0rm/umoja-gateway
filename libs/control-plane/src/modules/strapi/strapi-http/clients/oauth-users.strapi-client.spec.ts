import { firstValueFrom, of } from 'rxjs';
import { OAuthUsersStrapiClient } from './oauth-users.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthUserAttributes } from '../entities/oauth-user.attributes';

describe('OAuthUsersStrapiClient', () => {
  let client: OAuthUsersStrapiClient;
  let strapiClient: StrapiHttpClient;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthUserAttributes> = {
    data: [{ id: 1, documentId: 'user-1', attributes: { username: 'u1', password: 'p1' } }],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthUserAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthUserAttributes> = collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockReturnValue(of(collectionResponse)),
      post: jest.fn().mockReturnValue(of(singleResponse)),
      put: jest.fn().mockReturnValue(of(singleResponse)),
    } as unknown as StrapiHttpClient;
    client = new OAuthUsersStrapiClient(strapiClient);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: 'audiences' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListFirst', () => {
    it('calls getList with default pageSize 1', async () => {
      const result = await firstValueFrom(client.getListFirst());

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('calls getList with custom pageSize', async () => {
      await firstValueFrom(client.getListFirst(10));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'pagination[pageSize]': 10,
      });
    });
  });

  describe('getFirstFromList', () => {
    it('returns first entity from getListFirst', async () => {
      const result = await firstValueFrom(client.getFirstFromList());

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(client.getFirstFromList());

      expect(result).toBeNull();
    });
  });

  describe('getListByCredentials', () => {
    it('calls getList with username and password filters and audiences populate', async () => {
      const result = await firstValueFrom(
        client.getListByCredentials('user1', 'pass1'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'filters[username][$eq]': 'user1',
        'filters[password][$eq]': 'pass1',
        populate: 'audiences',
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('merges extraQuery', async () => {
      await firstValueFrom(
        client.getListByCredentials('u', 'p', { 'pagination[pageSize]': 1 }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'filters[username][$eq]': 'u',
        'filters[password][$eq]': 'p',
        populate: 'audiences',
        'pagination[pageSize]': 1,
      });
    });
  });

  describe('getFirstByCredentials', () => {
    it('returns first entity from getListByCredentials', async () => {
      const result = await firstValueFrom(
        client.getFirstByCredentials('user1', 'pass1'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByCredentials('u', 'p'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      const result = await firstValueFrom(
        client.getById('user-123', { populate: 'audiences' }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users/user-123',
        { populate: 'audiences' },
      );
      expect(result).toEqual(singleResponse.data);
    });

    it('encodes id in path', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      await firstValueFrom(client.getById('id/with/slash'));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('getByIdWithAudiences', () => {
    it('calls getById with populate audiences', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValue(
        of(singleResponse),
      );

      const result = await firstValueFrom(
        client.getByIdWithAudiences('user-id'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users/user-id',
        { populate: 'audiences' },
      );
      expect(result).toEqual(singleResponse.data);
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { username: 'new-user', password: 'secret' } };
      const result = await firstValueFrom(client.create(data));

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-users',
        data,
        undefined,
      );
      expect(result).toEqual(singleResponse.data);
    });
  });

  describe('put', () => {
    it('calls client.put with collection/id path, data and query', async () => {
      const data = { data: { password: 'updated' } };
      const result = await firstValueFrom(
        client.put('user-456', data, { populate: 'audiences' }),
      );

      expect((strapiClient as unknown as { put: jest.Mock }).put).toHaveBeenCalledWith(
        'oauth-users/user-456',
        data,
        { populate: 'audiences' },
      );
      expect(result).toEqual(singleResponse.data);
    });
  });
});
