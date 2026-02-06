import { BadGatewayException } from '@nestjs/common';
import { OAuthAuthorizationCodesStrapiClient } from './oauth-authorization-codes.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthAuthorizationCodeAttributes } from '../entities/oauth-authorization-code.attributes';

describe('OAuthAuthorizationCodesStrapiClient', () => {
  let client: OAuthAuthorizationCodesStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthAuthorizationCodeAttributes> = {
    data: [
      {
        id: 1,
        attributes: {
          authorizationCode: 'code-1',
          expiresAt: '2025-01-01T00:00:00Z',
          redirectUri: 'https://example.com/cb',
        },
      },
    ],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthAuthorizationCodeAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> =
    collectionResponse.data[0];

  beforeEach(() => {
    strapiClient = {
      get: jest.fn().mockResolvedValue(collectionResponse),
      post: jest.fn().mockResolvedValue(singleResponse),
      delete: jest.fn().mockResolvedValue({}),
    } as unknown as StrapiHttpClient;
    responseHelper = {
      ensureNoError: jest.fn(<T extends { error?: unknown }>(r: T): T => r),
      pickFirstEntity: jest.fn().mockReturnValue(firstEntity),
    } as unknown as StrapiResponseHelperService;
    client = new OAuthAuthorizationCodesStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
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

  describe('getListByAuthorizationCode', () => {
    it('calls getList with code filter', async () => {
      const result = await client.getListByAuthorizationCode('code-1');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        { 'filters[authorizationCode][$eq]': 'code-1' },
      );
      expect(result).toEqual(collectionResponse);
    });

    it('adds populate * when options.populate is true', async () => {
      await client.getListByAuthorizationCode('code-1', { populate: true });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        { 'filters[authorizationCode][$eq]': 'code-1', populate: '*' },
      );
    });
  });

  describe('getFirstByAuthorizationCode', () => {
    it('returns first entity from getListByAuthorizationCode', async () => {
      const result = await client.getFirstByAuthorizationCode('code-1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByAuthorizationCode('code-1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection, data, and undefined query', async () => {
      const data = { data: { authorizationCode: 'new-code' } };
      const result = await client.create(data);

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        data,
        undefined,
      );
      expect((responseHelper as unknown as { ensureNoError: jest.Mock }).ensureNoError).toHaveBeenCalledWith(
        singleResponse,
      );
      expect(result).toEqual(singleResponse);
    });
  });

  describe('deleteById', () => {
    it('calls client.delete with encoded path', async () => {
      await client.deleteById('doc-id-123');

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-authorization-codes/doc-id-123',
        undefined,
      );
    });

    it('encodes id in path', async () => {
      await client.deleteById('id/with/slash');

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-authorization-codes/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });
});
