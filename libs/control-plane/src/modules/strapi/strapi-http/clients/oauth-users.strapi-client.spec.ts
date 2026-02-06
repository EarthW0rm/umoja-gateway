import { BadGatewayException } from '@nestjs/common';
import { OAuthUsersStrapiClient } from './oauth-users.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthUserAttributes } from '../entities/oauth-user.attributes';

describe('OAuthUsersStrapiClient', () => {
  let client: OAuthUsersStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthUserAttributes> = {
    data: [{ id: 1, documentId: 'user-1', attributes: { username: 'u1', password: 'p1' } }],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthUserAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthUserAttributes> = collectionResponse.data[0];

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
    client = new OAuthUsersStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: 'audiences' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users',
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

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'pagination[pageSize]': 1,
      });
      expect(result).toEqual(collectionResponse);
    });

    it('calls getList with custom pageSize', async () => {
      await client.getListFirst(10);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'pagination[pageSize]': 10,
      });
    });
  });

  describe('getFirstFromList', () => {
    it('returns first entity from getListFirst', async () => {
      const result = await client.getFirstFromList();

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstFromList();

      expect(result).toBeNull();
    });
  });

  describe('getListByCredentials', () => {
    it('calls getList with username and password filters and audiences populate', async () => {
      const result = await client.getListByCredentials('user1', 'pass1');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-users', {
        'filters[username][$eq]': 'user1',
        'filters[password][$eq]': 'pass1',
        populate: 'audiences',
      });
      expect(result).toEqual(collectionResponse);
    });

    it('merges extraQuery', async () => {
      await client.getListByCredentials('u', 'p', { 'pagination[pageSize]': 1 });

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
      const result = await client.getFirstByCredentials('user1', 'pass1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByCredentials('u', 'p');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('calls client.get with collection/id path and query', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockResolvedValue(singleResponse);

      const result = await client.getById('user-123', { populate: 'audiences' });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users/user-123',
        { populate: 'audiences' },
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
        'oauth-users/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('getByIdWithAudiences', () => {
    it('calls getById with populate audiences', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockResolvedValue(singleResponse);

      const result = await client.getByIdWithAudiences('user-id');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-users/user-id',
        { populate: 'audiences' },
      );
      expect(result).toEqual(singleResponse);
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { username: 'new-user', password: 'secret' } };
      const result = await client.create(data);

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-users',
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
      const data = { data: { password: 'updated' } };
      const result = await client.put('user-456', data, { populate: 'audiences' });

      expect((strapiClient as unknown as { put: jest.Mock }).put).toHaveBeenCalledWith(
        'oauth-users/user-456',
        data,
        { populate: 'audiences' },
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });
  });
});
