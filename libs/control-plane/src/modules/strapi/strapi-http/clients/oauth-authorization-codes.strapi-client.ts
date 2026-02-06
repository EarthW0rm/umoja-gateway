import { Injectable, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { firstOrNull, toDataArray } from '../infra/operators';
import { StrapiHttpClient } from '../infra/strapi-http.client';
import { StrapiEntityViewService } from '../infra/strapi-entity-view.service';
import type {
  StrapiEntity,
  StrapiQueryParams,
} from '../infra/strapi.types';
import type { StrapiOAuthAuthorizationCodeAttributes } from '../entities/oauth-authorization-code.attributes';

/**
 * Strapi client for the oauth-authorization-codes collection.
 * Exposes GET list, POST (create), DELETE by id / by entity, and getFirst* helpers.
 */
@Injectable()
export class OAuthAuthorizationCodesStrapiClient {
  private readonly COLLECTION = 'oauth-authorization-codes';

  constructor(
    private readonly client: StrapiHttpClient,
    private readonly strapiEntityView: StrapiEntityViewService,
  ) {}

  /**
   * Fetches the first oauth-authorization-code matching code, or null.
   * @param options.populate - When true, populates all relations.
   */
  getFirstByAuthorizationCode(
    code: string,
    options?: { populate?: boolean },
  ): Observable<StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> | null> {
    return this.getListByAuthorizationCode(code, options).pipe(firstOrNull());
  }

  getListByAuthorizationCode(
    code: string,
    options?: { populate?: boolean },
  ): Observable<StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>[]> {
    return this.getList({
      'filters[authorizationCode][$eq]': code,
      ...(options?.populate && { populate: '*' }),
    });
  }

  getList(
    query?: StrapiQueryParams,
  ): Observable<StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>[]> {
    return this.client
      .get<{ data: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>[] }>(
        this.COLLECTION,
        query,
      )
      .pipe(toDataArray());
  }

  create(
    data: { data: Record<string, unknown> },
  ): Observable<StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> | null> {
    return this.client
      .post<{
        data: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes> | null;
      }>(this.COLLECTION, data, undefined)
      .pipe(map((r) => r.data ?? null));
  }

  /**
   * Deletes a document by its id (documentId or numeric id).
   * @param id - Document identifier (Strapi v4 id or v5 documentId).
   * @returns Observable that completes when the delete request finishes.
   */
  deleteById(id: string): Observable<unknown> {
    const path = `${this.COLLECTION}/${encodeURIComponent(id)}`;
    return this.client.delete<unknown>(path, undefined);
  }

  /**
   * Deletes the document represented by the given entity.
   * Resolves the document id from the entity (documentId or id) and calls {@link deleteById}.
   * @param entity - Strapi entity previously returned by this client.
   * @returns Observable that completes when the delete request finishes.
   * @throws Error if the entity has no documentId or id.
   */
  deleteByEntity(
    entity: StrapiEntity<StrapiOAuthAuthorizationCodeAttributes>,
  ): Observable<unknown> {
    const docId = this.strapiEntityView.toView(entity).getDocId();
    if (!docId) {
      throw new BadRequestException(
        'Cannot delete by entity: entity has no documentId or id',
      );
    }
    return this.deleteById(docId);
  }
}
