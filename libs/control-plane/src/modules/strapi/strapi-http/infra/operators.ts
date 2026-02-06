import type { OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Shape of a Strapi-like response whose payload is an optional array (collection).
 */
export type CollectionLike<T> = { data?: T[] };

/**
 * RxJS operator that maps a collection response (object with optional `data` array)
 * to its first item, or null if `data` is missing or empty.
 *
 * @returns OperatorFunction mapping CollectionLike<T> to T | null
 */
export function firstFromCollection<T>(): OperatorFunction<
  CollectionLike<T>,
  T | null
> {
  return map((response) =>
    response.data?.length ? response.data[0] : null,
  );
}

/**
 * RxJS operator that maps an array to its first element, or null if empty.
 * Use when the upstream already emits an array (e.g. unwrapped list response).
 *
 * @returns OperatorFunction mapping T[] to T | null
 */
export function firstOrNull<T>(): OperatorFunction<T[], T | null> {
  return map((arr) => (arr?.length ? arr[0] : null));
}

/**
 * RxJS operator that maps a Strapi-like collection response to its data array.
 * Use after client.get when the API returns { data: T[] }.
 *
 * @returns OperatorFunction mapping CollectionLike<T> to T[]
 */
export function toDataArray<T>(): OperatorFunction<CollectionLike<T>, T[]> {
  return map((r) => r.data ?? []);
}

/**
 * RxJS operator that normalizes null/undefined to null and passes through other values.
 *
 * @returns OperatorFunction mapping T | null | undefined to T | null
 */
export function orNull<T>(): OperatorFunction<T | null | undefined, T | null> {
  return map((x) => x ?? null);
}

/**
 * RxJS operator that maps only when the value is present (not null/undefined).
 * When the value is null or undefined, emits null; otherwise runs the projection.
 * Use to avoid "if (!value) return null" at the start of map callbacks.
 *
 * @param project - Function to apply when value is present. Can return null.
 * @returns OperatorFunction mapping T | null | undefined to R | null
 */
export function whenPresent<T, R>(
  project: (value: T) => R | null,
): OperatorFunction<T | null | undefined, R | null> {
  return map((x) => (x != null ? project(x) : null));
}
