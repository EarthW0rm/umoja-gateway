import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InMemoryAuthRepository } from './in-memory-auth.repository';
import type { OAuthClient, OAuthUser } from '@oauth/oauth';
import { AUTH_REPOSITORY } from '@oauth/oauth';

/**
 * Input payload for registering a new OAuth client in the demo.
 */
interface RegisterClientDto {
  name: string;
  grants?: string[];
  redirectUris?: string[];
  scopes?: string[];
  audiences?: string[];
  userId?: string;
}

/**
 * Demo service that registers OAuth clients and users in the in-memory repository
 * and validates API keys for admin-style endpoints.
 */
@Injectable()
export class AuthExampleService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly authRepository: InMemoryAuthRepository) {
    this.seed();
  }

  /**
   * Registers a new OAuth client in the in-memory store.
   * @param dto - Client name, grants, redirectUris, scopes, audiences, optional userId.
   * @returns The created or updated OAuth client (includes clientSecret).
   */
  registerClient(dto: RegisterClientDto): OAuthClient {
    const clientId = randomUUID();
    const clientSecret = randomUUID();
    const client: OAuthClient = {
      id: clientId,
      clientSecret,
      grants: dto.grants ?? ['client_credentials', 'password', 'refresh_token'],
      redirectUris: dto.redirectUris ?? [],
      audiences: dto.audiences ?? ['umoja-clients'],
      scope: dto.scopes,
      userId: dto.userId,
    };
    return this.authRepository.upsertClient(client);
  }

  /**
   * Registers a new user in the in-memory store (for password grant).
   * @param username - Login identifier.
   * @param password - Plain password stored for demo comparison.
   * @param scopes - Optional default scopes for the user.
   * @returns The created or updated OAuth user.
   */
  registerUser(username: string, password: string, scopes?: string[]): OAuthUser {
    const user: OAuthUser & { password?: string } = {
      id: username,
      username,
      password,
      scope: scopes,
    };
    return this.authRepository.upsertUser(user);
  }

  /**
   * Validates the x-api-key header value via the repository (single data conduit).
   * @param apiKey - Value from the request header.
   * @throws {UnauthorizedException} When the key is missing or does not match.
   */
  validateApiKey(apiKey?: string): void {
    if (!this.authRepository.validateApiKey?.(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  /**
   * Seeds the in-memory repository with a demo client and user for e2e and manual testing.
   */
  private seed(): void {
    if (!this.authRepository) return;
    this.authRepository.upsertClient({
      id: 'demo-client',
      clientSecret: 'demo-secret',
      grants: ['password', 'client_credentials', 'refresh_token'],
      scope: ['read', 'write'],
      userId: 'demo',
    });
    this.authRepository.upsertUser({
      id: 'demo',
      username: 'demo',
      password: 'demo',
      scope: ['read', 'write'],
    });
  }
}
