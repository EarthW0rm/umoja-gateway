import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable, throwError, timeout } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { AxiosRequestConfig } from 'axios';
import {
  CONTROL_PLANE_HTTP_TIMEOUT,
  CONTROL_PLANE_STRAPI_API_TOKEN,
  CONTROL_PLANE_STRAPI_BASE_URL,
} from '../../../../control-plane.tokens';
import type { StrapiQueryParams } from './strapi.types';

/** Default HTTP timeout in ms when not configured or invalid. */
const DEFAULT_HTTP_TIMEOUT_MS = 5000;

function toValidTimeoutMs(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  return n != null && n > 0 ? n : DEFAULT_HTTP_TIMEOUT_MS;
}

/**
 * Low-level HTTP client for the Strapi REST API.
 * Handles base URL, bearer auth, timeout, and standard error handling.
 * All requests go to {baseUrl}/api/{path}.
 * Returns RxJS Observables for composition and consistent async handling.
 */
@Injectable()
export class StrapiHttpClient {
  private readonly logger = new Logger(StrapiHttpClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    @Inject(CONTROL_PLANE_STRAPI_BASE_URL) baseUrl: string,
    @Inject(CONTROL_PLANE_STRAPI_API_TOKEN) private readonly apiToken: string,
    @Inject(CONTROL_PLANE_HTTP_TIMEOUT) timeoutMs: number | undefined,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = toValidTimeoutMs(timeoutMs);
  }

  /**
   * Performs a GET request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients' or 'oauth-clients/123').
   * @param query - Optional query parameters.
   * @returns Observable of parsed JSON response body.
   */
  get<T>(path: string, query?: StrapiQueryParams): Observable<T> {
    return this.request<T>(path, { method: 'GET' }, query);
  }

  /**
   * Performs a POST request to the Strapi API.
   * @param path - API path without leading slash.
   * @param body - Request body (will be JSON-stringified).
   * @param query - Optional query parameters.
   * @returns Observable of parsed JSON response body.
   */
  post<T>(path: string, body: unknown, query?: StrapiQueryParams): Observable<T> {
    return this.request<T>(path, { method: 'POST', data: body }, query);
  }

  /**
   * Performs a PUT request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients/123').
   * @param body - Request body (will be JSON-stringified).
   * @param query - Optional query parameters.
   * @returns Observable of parsed JSON response body.
   */
  put<T>(path: string, body: unknown, query?: StrapiQueryParams): Observable<T> {
    return this.request<T>(path, { method: 'PUT', data: body }, query);
  }

  /**
   * Performs a DELETE request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients/123').
   * @param query - Optional query parameters.
   * @returns Observable of parsed JSON response body.
   */
  delete<T>(path: string, query?: StrapiQueryParams): Observable<T> {
    return this.request<T>(path, { method: 'DELETE' }, query);
  }

  /**
   * Executes an HTTP request with auth, timeout, and error handling.
   * @param path - API path segment (no leading slash).
   * @param config - Axios request config (method, data, etc.).
   * @param query - Optional query params.
   * @returns Observable of parsed response body.
   */
  private request<T>(
    path: string,
    config: Pick<AxiosRequestConfig, 'method' | 'data'>,
    query?: StrapiQueryParams,
  ): Observable<T> {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = this.buildUrl(normalizedPath, query);
    const method = config.method ?? 'GET';

    const requestConfig: AxiosRequestConfig = {
      url,
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      data: config.data,
      timeout: this.timeoutMs,
    };

    return this.httpService.request<T>(requestConfig).pipe(
      timeout(this.timeoutMs),
      map((response) => response.data),
      catchError((error: unknown) => {
        this.logRequestError(method, path, url, error, config.data);
        const cause =
          error instanceof Error ? error : new Error(String(error));
        return throwError(
          () => new BadGatewayException('Control plane unavailable', { cause }),
        );
      }),
    );
  }

  private buildUrl(path: string, query?: StrapiQueryParams): string {
    const url = new URL(`${this.baseUrl}/api/${path}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private logRequestError(
    method: string,
    path: string,
    url: string,
    error: unknown,
    requestBody?: unknown,
  ): void {
    const err = error as Error & {
      response?: { status?: number; statusText?: string; data?: unknown };
    };
    const status = err.response?.status;
    const msg =
      err.name === 'TimeoutError'
        ? 'Strapi request timed out'
        : status === 401
          ? 'Strapi request unauthorized (401) – check CONTROL_PLANE_STRAPI_API_TOKEN'
          : 'Strapi request failed';
    this.logger.error({
      msg,
      method,
      path,
      url,
      ...(err.name === 'TimeoutError' && { timeoutMs: this.timeoutMs }),
      status,
      statusText: err.response?.statusText,
      error: err.message,
      ...(requestBody !== undefined && { requestBodySent: requestBody }),
    });
  }
}
