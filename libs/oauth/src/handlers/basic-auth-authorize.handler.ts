import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { InvalidRequestException, ServerException, UnauthorizedRequestException } from '../exceptions';
import type { OAuthUser } from '../interfaces';
import type { AuthRepository } from '../interfaces/auth-repository.interface';
import { parseBasicAuth } from '../utils/basic-auth.util';
import { AUTH_REPOSITORY } from '../config/oauth.tokens';

/**
 * Handler that authenticates the resource owner for the authorization code flow using HTTP Basic auth.
 * Parses Authorization: Basic, validates credentials via the auth repository's validateBasicAuth, and returns the OAuthUser.
 * Use this as authenticateHandler in AuthorizeOptions when /oauth/authorize should accept Basic auth (username/password).
 */
@Injectable()
export class BasicAuthAuthorizeHandler {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Authenticates the request using Basic auth and returns the resource owner (OAuthUser).
   * @param request Input payload containing Authorization: Basic header.
   * @param _response Unused; kept for interface compatibility with AuthorizeHandler.
   * @returns The validated OAuth user.
   * @throws {InvalidRequestException} When Authorization header is missing or not Basic.
   * @throws {UnauthorizedRequestException} When credentials are invalid.
   * @throws {ServerException} When repository does not implement validateBasicAuth.
   */
  async handle(request: FastifyRequest, _response: FastifyReply): Promise<OAuthUser> {
    const credentials = parseBasicAuth({ headers: request.headers ?? {} });
    if (!credentials) {
      throw new InvalidRequestException(
        'Invalid request: missing or malformed Authorization header (expected Basic base64(username:password))',
      );
    }

    if (typeof this.authRepository.validateBasicAuth !== 'function') {
      throw new ServerException(
        'Server error: auth repository does not implement validateBasicAuth (required for Basic auth on /oauth/authorize)',
      );
    }

    const result = await this.authRepository.validateBasicAuth(credentials.name, credentials.pass);
    if (!result?.user) {
      throw new UnauthorizedRequestException('Unauthorized request: invalid username or password');
    }

    return result.user as OAuthUser;
  }
}
