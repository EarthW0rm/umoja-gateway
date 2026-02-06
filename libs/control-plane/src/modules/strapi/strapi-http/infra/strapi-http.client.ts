import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import type { AxiosRequestConfig } from 'axios';
import {
  CONTROL_PLANE_HTTP_TIMEOUT,
  CONTROL_PLANE_STRAPI_API_TOKEN,
  CONTROL_PLANE_STRAPI_BASE_URL,
} from '../../../../control-plane.tokens';
import type { StrapiQueryParams } from './strapi.types';

/**
 * Low-level HTTP client for the Strapi REST API.
 * Handles base URL, bearer auth, timeout, and standard error handling.
 * All requests go to {baseUrl}/api/{path}.
 */
@Injectable()
export class StrapiHttpClient {
  private readonly logger = new Logger(StrapiHttpClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    @Inject(CONTROL_PLANE_STRAPI_BASE_URL) baseUrl: string,
    @Inject(CONTROL_PLANE_STRAPI_API_TOKEN) private readonly apiToken: string,
    @Inject(CONTROL_PLANE_HTTP_TIMEOUT) private readonly timeoutMs: number,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Performs a GET request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients' or 'oauth-clients/123').
   * @param query - Optional query parameters.
   * @returns Parsed JSON response.
   * @throws {BadGatewayException} When the request fails or times out.
   */
  async get<T>(path: string, query?: StrapiQueryParams): Promise<T> {
    return this.request<T>(path, { method: 'GET' }, query);
  }

  /**
   * Performs a POST request to the Strapi API.
   * @param path - API path without leading slash.
   * @param body - Request body (will be JSON-stringified).
   * @param query - Optional query parameters.
   * @returns Parsed JSON response.
   * @throws {BadGatewayException} When the request fails or times out.
   */
  async post<T>(path: string, body: unknown, query?: StrapiQueryParams): Promise<T> {
    return this.request<T>(path, { method: 'POST', data: body }, query);
  }

  /**
   * Performs a PUT request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients/123').
   * @param body - Request body (will be JSON-stringified).
   * @param query - Optional query parameters.
   * @returns Parsed JSON response.
   * @throws {BadGatewayException} When the request fails or times out.
   */
  async put<T>(path: string, body: unknown, query?: StrapiQueryParams): Promise<T> {
    return this.request<T>(path, { method: 'PUT', data: body }, query);
  }

  /**
   * Performs a DELETE request to the Strapi API.
   * @param path - API path without leading slash (e.g. 'oauth-clients/123').
   * @param query - Optional query parameters.
   * @returns Parsed JSON response.
   * @throws {BadGatewayException} When the request fails or times out.
   */
  async delete<T>(path: string, query?: StrapiQueryParams): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' }, query);
  }

  /**
   * Executes an HTTP request with auth, timeout, and error handling.
   * @param path - API path segment (no leading slash).
   * @param config - Axios request config (method, data, etc.).
   * @param query - Optional query params.
   * @returns Parsed response body.
   * @throws {BadGatewayException} On non-2xx, timeout, or parse error.
   */
  private async request<T>(
    path: string,
    config: Pick<AxiosRequestConfig, 'method' | 'data'>,
    query?: StrapiQueryParams,
  ): Promise<T> {
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

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>(requestConfig).pipe(timeout(this.timeoutMs)),
      );
      return response.data;
    } catch (error: unknown) {
      this.logRequestError(method, path, url, error, config.data);
      throw new BadGatewayException('Control plane unavailable');
    }
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
    const err = error as Error & { response?: { status?: number; statusText?: string; data?: unknown } };
    this.logger.error({
      msg: err.name === 'TimeoutError' ? 'Strapi request timed out' : 'Strapi request failed',
      method,
      path,
      url,
      timeoutMs: err.name === 'TimeoutError' ? this.timeoutMs : undefined,
      status: err.response?.status,
      statusText: err.response?.statusText,
      error: err.message,
      ...(requestBody !== undefined && { requestBodySent: requestBody }),
    });
  }
}
