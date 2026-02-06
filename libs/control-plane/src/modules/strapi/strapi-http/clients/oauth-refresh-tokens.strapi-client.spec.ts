import { firstValueFrom, of } from 'rxjs';
import { OAuthRefreshTokensStrapiClient } from './oauth-refresh-tokens.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiEntityViewService } from '../infra/strapi-entity-view.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthRefreshTokenAttributes } from '../entities/oauth-refresh-token.attributes';

describe('OAuthRefreshTokensStrapiClient', () => {
  let client: OAuthRefreshTokensStrapiClient;
  let strapiClient: StrapiHttpClient;
  let strapiEntityView: StrapiEntityViewService;

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
      get: jest.fn().mockReturnValue(of(collectionResponse)),
      post: jest.fn().mockReturnValue(of(singleResponse)),
      delete: jest.fn().mockReturnValue(of({})),
    } as unknown as StrapiHttpClient;
    strapiEntityView = new StrapiEntityViewService();
    client = new OAuthRefreshTokensStrapiClient(strapiClient, strapiEntityView);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-refresh-tokens',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListByRefreshToken', () => {
    it('calls getList with refreshToken filter', async () => {
      const result = await firstValueFrom(
        client.getListByRefreshToken('rt-1'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-refresh-tokens', {
        'filters[refreshToken][$eq]': 'rt-1',
      });
      expect(result).toEqual(collectionResponse.data);
    });

    it('adds populate * when options.populate is true', async () => {
      await firstValueFrom(
        client.getListByRefreshToken('rt-1', { populate: true }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith('oauth-refresh-tokens', {
        'filters[refreshToken][$eq]': 'rt-1',
        populate: '*',
      });
    });
  });

  describe('getFirstByRefreshToken', () => {
    it('returns first entity from getListByRefreshToken', async () => {
      const result = await firstValueFrom(
        client.getFirstByRefreshToken('rt-1'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByRefreshToken('rt-1'),
      );

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection and data', async () => {
      const data = { data: { refreshToken: 'new-rt' } };
      const result = await firstValueFrom(client.create(data));

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-refresh-tokens',
        data,
        undefined,
      );
      expect(result).toEqual(singleResponse.data);
    });
  });

  describe('deleteById', () => {
    it('calls client.delete with encoded path', async () => {
      await firstValueFrom(client.deleteById('doc-id-123'));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-refresh-tokens/doc-id-123',
        undefined,
      );
    });

    it('encodes id in path', async () => {
      await firstValueFrom(client.deleteById('id/with/slash'));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-refresh-tokens/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('deleteByEntity', () => {
    it('resolves doc id from entity and calls delete', async () => {
      await firstValueFrom(client.deleteByEntity(firstEntity));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-refresh-tokens/1',
        undefined,
      );
    });

    it('uses documentId when present (v5 style)', async () => {
      const entityV5 = {
        documentId: 'abc24charsdocumentid',
        attributes: { refreshToken: 'rt', refreshTokenExpiresAt: '' },
      } as StrapiEntity<StrapiOAuthRefreshTokenAttributes>;
      await firstValueFrom(client.deleteByEntity(entityV5));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-refresh-tokens/abc24charsdocumentid',
        undefined,
      );
    });

    it('throws when entity has no documentId or id', () => {
      const entityNoId = { attributes: {} } as StrapiEntity<StrapiOAuthRefreshTokenAttributes>;
      expect(() => client.deleteByEntity(entityNoId)).toThrow(
        'Cannot delete by entity: entity has no documentId or id',
      );
    });
  });
});
