/**
 * Shared Strapi API types used by the strapi-http client layer.
 * Supports Strapi v4 (id + attributes) and v5 (documentId, optional attributes).
 */

/**
 * Query parameters for Strapi REST requests (filters, populate, pagination).
 */
export type StrapiQueryParams = Record<string, string | number | boolean | undefined>;

/**
 * Strapi document shape: v4 uses id + attributes; v5 uses documentId with optional attributes.
 */
export interface StrapiEntity<T = Record<string, unknown>> {
  id?: number;
  documentId?: string;
  attributes?: T;
  [key: string]: unknown;
}

/**
 * Error payload returned by Strapi when a request fails.
 */
export interface StrapiError {
  message?: string;
  status?: number;
  name?: string;
  details?: unknown;
}

/**
 * Response shape for a single document (GET by id, POST, PUT).
 */
export interface StrapiSingleResponse<T> {
  data: StrapiEntity<T> | null;
  meta?: unknown;
  error?: StrapiError;
}

/**
 * Response shape for a collection (list endpoints).
 */
export interface StrapiCollectionResponse<T> {
  data: StrapiEntity<T>[];
  meta?: unknown;
  error?: StrapiError;
}

/**
 * Relation shape for a single related document (populate).
 * Strapi v4/v5 may return { data: entity }, the entity itself, or null.
 */
export type StrapiRelationSingle<T> =
  | { data: StrapiEntity<T> | null }
  | StrapiEntity<T>
  | null
  | undefined;

/**
 * Relation shape for multiple related documents (populate).
 * Strapi v4/v5 may return { data: entity[] }, the array itself, or null.
 */
export type StrapiRelationMany<T> =
  | { data: StrapiEntity<T>[] }
  | StrapiEntity<T>[]
  | null
  | undefined;
