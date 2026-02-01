import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_REPOSITORY } from '../config/oauth.tokens';
import { UnauthorizedRequestException } from '../exceptions';
import type { AuthRepository } from '../interfaces/auth-repository.interface';

/**
 * Guard that validates the request using HTTP Basic auth (Authorization: Basic base64(user:password)).
 * Uses the auth repository (AUTH_REPOSITORY) as the single data conduit; the repository must implement validateBasicAuth.
 * On success, attaches the validated user to the request (request.user).
 */
@Injectable()
export class BasicAuthGuard implements CanActivate {
  /**
   * Creates a Basic auth guard.
   * @param authRepository Auth repository that implements validateBasicAuth (injected via AUTH_REPOSITORY).
   */
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Parses the Authorization: Basic header, validates credentials via the repository, and attaches user to the request.
   * @param context Execution context containing the HTTP request.
   * @returns True when credentials are valid.
   * @throws {UnauthorizedRequestException} When the header is missing, malformed, credentials are invalid, or repository does not implement validateBasicAuth.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { username, password } = this.getCredentialsFromRequest(request);

    const result =
      typeof this.authRepository.validateBasicAuth === 'function'
        ? await this.authRepository.validateBasicAuth(username, password)
        : null;
    if (!result) {
      throw new UnauthorizedRequestException('Unauthorized request: invalid username or password');
    }

    this.attachUser(request, result.user);
    return true;
  }

  /**
   * Extracts username and password from the Authorization: Basic header.
   * @param request HTTP request.
   * @returns Decoded username and password.
   * @throws {UnauthorizedRequestException} When the header is missing or malformed.
   */
  private getCredentialsFromRequest(request: FastifyRequest): { username: string; password: string } {
    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedRequestException('Unauthorized request: missing Authorization header');
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
      throw new UnauthorizedRequestException('Unauthorized request: expected Authorization: Basic');
    }

    let decoded: string;
    try {
      decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    } catch {
      throw new UnauthorizedRequestException('Unauthorized request: invalid Basic auth encoding');
    }

    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      throw new UnauthorizedRequestException('Unauthorized request: invalid Basic auth format');
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return { username, password };
  }

  /**
   * Attaches the validated user to the request.
   * @param request HTTP request to mutate.
   * @param user Validated user object.
   */
  private attachUser(request: FastifyRequest, user: unknown): void {
    (request as FastifyRequest & { user?: unknown }).user = user;
  }
}
