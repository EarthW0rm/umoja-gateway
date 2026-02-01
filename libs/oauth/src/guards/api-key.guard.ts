import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_REPOSITORY } from '../config/oauth.tokens';
import { UnauthorizedRequestException } from '../exceptions';
import type { AuthRepository } from '../interfaces/auth-repository.interface';

/** Default header name for the API key. */
export const DEFAULT_API_KEY_HEADER = 'x-api-key';

/**
 * Guard that validates the request using an x-api-key header.
 * Uses the auth repository (AUTH_REPOSITORY) as the single data conduit; the repository must implement validateApiKey.
 * Uses the header name from DEFAULT_API_KEY_HEADER ('x-api-key'); override by extending the guard if needed.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly headerName = DEFAULT_API_KEY_HEADER;

  /**
   * Creates an API key guard.
   * @param authRepository Auth repository that implements validateApiKey (injected via AUTH_REPOSITORY).
   */
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Reads the API key from the request header and validates it via the repository.
   * @param context Execution context containing the HTTP request.
   * @returns True when the API key is valid.
   * @throws {UnauthorizedRequestException} When the key is missing, invalid, or repository does not implement validateApiKey.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const apiKey = this.getApiKeyFromRequest(request);

    if (typeof this.authRepository.validateApiKey !== 'function' || !this.authRepository.validateApiKey(apiKey)) {
      throw new UnauthorizedRequestException('Unauthorized request: invalid or missing API key');
    }
    return true;
  }

  /**
   * Extracts the API key from the request header.
   * @param request HTTP request.
   * @returns Header value or undefined.
   */
  private getApiKeyFromRequest(request: FastifyRequest): string | undefined {
    const value = request.headers[this.headerName.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value as string | undefined;
  }
}
