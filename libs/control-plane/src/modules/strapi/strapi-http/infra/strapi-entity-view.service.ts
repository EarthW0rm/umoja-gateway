import { Injectable } from '@nestjs/common';
import { StrapiEntity } from './strapi.types';


/**
 * Strapi entity with prototype helpers for document id and attributes.
 * Use {@link StrapiEntityViewService.toView} to obtain from a plain API response.
 */
export interface StrapiEntityView<T = Record<string, unknown>> extends StrapiEntity<T> {
  /**
   * Resolves the document identifier (v4 id or v5 documentId).
   * @returns Non-empty string id or empty string when missing.
   */
  getDocId(): string;
  /**
   * Resolves the attributes payload (v4 attributes envelope or v5 flat root).
   * @returns The typed attributes object.
   */
  getAttrs(): T;
}

/**
 * Injectable service that provides Strapi entity view helpers via Nest DI.
 * Use this in services/repositories that need to work with StrapiEntityView (getDocId / getAttrs).
 */
@Injectable()
export class StrapiEntityViewService {
  /**
   * Returns the same entity with getDocId() and getAttrs() attached (mutates in place).
   * Idempotent: safe to call multiple times on the same object.
   *
   * @param entity - Raw entity from Strapi API (v4 or v5 shape).
   * @returns The entity as StrapiEntityView.
   */
  toView<T>(entity: StrapiEntity<T>): StrapiEntityView<T> {
    const e = entity as StrapiEntityView<T>;
    if (typeof e.getDocId === 'function' && typeof e.getAttrs === 'function') {
      return e;
    }
    e.getDocId = function getDocId(): string {
      const id = this.documentId ?? this.id;
      return id != null ? String(id) : '';
    };
    e.getAttrs = function getAttrs(): T {
      return ((this as StrapiEntity<T>).attributes ?? this) as T;
    };
    return e;
  }
}
