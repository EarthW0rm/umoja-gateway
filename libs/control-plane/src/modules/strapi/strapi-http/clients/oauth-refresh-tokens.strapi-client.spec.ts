import { BadGatewayException } from '@nestjs/common';
import { OAuthRefreshTokensStrapiClient } from './oauth-refresh-tokens.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiResponseHelperService } from '../infra/strapi-response-helper.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthRefreshTokenAttributes } from '../entities/oauth-refresh-token.attributes';

describe('OAuthRefreshTokensStrapiClient', () => {
  let client: OAuthRefreshTokensStrapiClient;
  let strapiClient: StrapiHttpClient;
  let responseHelper: StrapiResponseHelperService;

  const collectionResponse: StrapiCollectionResponse<StrapiOAuthRefreshTokenAttributes> = {
    data: [
      {
        id: 1,
        attributes: {
          refreshToken: 'rt-1',
          refreshTokenExpiresAt: '2025-01-01T00:00:00Z',
        },
      },
    ],
  };
  const singleResponse: StrapiSingleResponse<StrapiOAuthRefreshTokenAttributes> = {
    data: collectionResponse.data[0],
  };
  const firstEntity: StrapiEntity<StrapiOAuthRefreshTokenAttributes> =
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
    client = new OAuthRefreshTokensStrapiClient(strapiClient, responseHelper);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await client.getList(query);

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-refresh-tokens',
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

  describe('getListByRefreshToken', () => {
    it('calls getList with refreshToken filter', async () => {
      const result = await client.getListByRefreshToken('rt-1');

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-refresh-tokens', {
        'filters[refreshToken][$eq]': 'rt-1',
      });
      expect(result).toEqual(collectionResponse);
    });

    it('adds populate * when options.populate is true', async () => {
      await client.getListByRefreshToken('rt-1', { populate: true });

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-refresh-tokens', {
        'filters[refreshToken][$eq]': 'rt-1',
        populate: '*',
      });
    });
  });

  describe('getFirstByRefreshToken', () => {
    it('returns first entity from getListByRefreshToken', async () => {
      const result = await client.getFirstByRefreshToken('rt-1');

      expect((responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity).toHaveBeenCalledWith(
        collectionResponse,
      );
      expect(result).toEqual(firstEntity);
    });

    it('returns null when pickFirstEntity returns null', async () => {
      (responseHelper as unknown as { pickFirstEntity: jest.Mock }).pickFirstEntity.mockReturnValue(null);

      const result = await client.getFirstByRefreshToken('rt-1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { refreshToken: 'new-rt' } };
      const result = await client.create(data);

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-refresh-tokens',
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
        'oauth-refresh-tokens/doc-id-123',
        undefined,
      );
    });

    it('encodes id in path', async () => {
      await client.deleteById('id/with/slash');

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-refresh-tokens/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });
});
