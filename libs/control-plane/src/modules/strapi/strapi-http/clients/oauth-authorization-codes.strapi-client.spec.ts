import { firstValueFrom, of } from 'rxjs';
import { OAuthAuthorizationCodesStrapiClient } from './oauth-authorization-codes.strapi-client';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiEntityViewService } from '../infra/strapi-entity-view.service';
import type {
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiSingleResponse,
} from '../infra/strapi.types';
import type { StrapiOAuthAuthorizationCodeAttributes } from '../entities/oauth-authorization-code.attributes';

describe('OAuthAuthorizationCodesStrapiClient', () => {
  let client: OAuthAuthorizationCodesStrapiClient;
  let strapiClient: StrapiHttpClient;
  let strapiEntityView: StrapiEntityViewService;

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
      get: jest.fn().mockReturnValue(of(collectionResponse)),
      post: jest.fn().mockReturnValue(of(singleResponse)),
      delete: jest.fn().mockReturnValue(of({})),
    } as unknown as StrapiHttpClient;
    strapiEntityView = new StrapiEntityViewService();
    client = new OAuthAuthorizationCodesStrapiClient(strapiClient, strapiEntityView);
  });

  describe('getList', () => {
    it('calls client.get with collection name and query', async () => {
      const query = { populate: '*' };
      const result = await firstValueFrom(client.getList(query));

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        query,
      );
      expect(result).toEqual(collectionResponse.data);
    });
  });

  describe('getListByAuthorizationCode', () => {
    it('calls getList with code filter', async () => {
      const result = await firstValueFrom(
        client.getListByAuthorizationCode('code-1'),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        { 'filters[authorizationCode][$eq]': 'code-1' },
      );
      expect(result).toEqual(collectionResponse.data);
    });

    it('adds populate * when options.populate is true', async () => {
      await firstValueFrom(
        client.getListByAuthorizationCode('code-1', { populate: true }),
      );

      expect((strapiClient as unknown as { get: jest.Mock }).get).toHaveBeenCalledWith(
        'oauth-authorization-codes',
        { 'filters[authorizationCode][$eq]': 'code-1', populate: '*' },
      );
    });
  });

  describe('getFirstByAuthorizationCode', () => {
    it('returns first entity from getListByAuthorizationCode', async () => {
      const result = await firstValueFrom(
        client.getFirstByAuthorizationCode('code-1'),
      );

      expect(result).toEqual(firstEntity);
    });

    it('returns null when collection is empty', async () => {
      (strapiClient as unknown as { get: jest.Mock }).get.mockReturnValueOnce(
        of({ data: [] }),
      );

      const result = await firstValueFrom(
        client.getFirstByAuthorizationCode('code-1'),
      );

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls client.post with collection, data, and undefined query', async () => {
      const data = { data: { authorizationCode: 'new-code' } };
      const result = await firstValueFrom(client.create(data));

      expect((strapiClient as unknown as { post: jest.Mock }).post).toHaveBeenCalledWith(
        'oauth-authorization-codes',
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
        'oauth-authorization-codes/doc-id-123',
        undefined,
      );
    });

    it('encodes id in path', async () => {
      await firstValueFrom(client.deleteById('id/with/slash'));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-authorization-codes/id%2Fwith%2Fslash',
        undefined,
      );
    });
  });

  describe('deleteByEntity', () => {
    it('resolves doc id from entity and calls delete', async () => {
      await firstValueFrom(client.deleteByEntity(firstEntity));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-authorization-codes/1',
        undefined,
      );
    });

    it('uses documentId when present (v5 style)', async () => {
      const entityV5 = {
        documentId: 'abc24charsdocumentid',
        attributes: { authorizationCode: 'code', expiresAt: '', redirectUri: '' },
      } as StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>;
      await firstValueFrom(client.deleteByEntity(entityV5));

      expect((strapiClient as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
        'oauth-authorization-codes/abc24charsdocumentid',
        undefined,
      );
    });

    it('throws when entity has no documentId or id', () => {
      const entityNoId = { attributes: {} } as StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>;
      expect(() => client.deleteByEntity(entityNoId)).toThrow(
        'Cannot delete by entity: entity has no documentId or id',
      );
    });
  });
});
