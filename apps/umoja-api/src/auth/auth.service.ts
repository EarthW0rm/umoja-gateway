import { Injectable, UnauthorizedException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { OAuthClient, OAuthUser, AuthRepository } from '@oauth/oauth';
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
  private readonly logger = new Logger(AuthExampleService.name);

  constructor(@Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository) {
    this.logger.debug({
      msg: 'AuthExampleService initialized',
      repoType: this.authRepository?.constructor?.name ?? 'unknown',
      hasUpsertClient: typeof (this.authRepository as any)?.upsertClient === 'function',
      hasUpsertUser: typeof (this.authRepository as any)?.upsertUser === 'function',
    });
    this.seed();
  }

  /**
   * Registers a new OAuth client in the in-memory store.
   * @param dto - Client name, grants, redirectUris, scopes, audiences, optional userId.
   * @returns The created or updated OAuth client (includes clientSecret).
   */
  async registerClient(dto: RegisterClientDto): Promise<OAuthClient> {
    this.logger.debug({
      msg: 'registerClient called',
      name: dto?.name,
      grantsCount: dto?.grants?.length ?? 0,
    });
    const repo = this.getMutableRepo();
    if (!repo) {
      this.logger.warn({
        msg: 'registerClient failed: repository does not support mutations',
        repoType: this.authRepository?.constructor?.name ?? 'unknown',
      });
      throw new BadRequestException('Auth repository does not support mutations');
    }
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
    this.logger.debug({ msg: 'Calling repo.upsertClient', clientId });
    const result = await Promise.resolve(repo.upsertClient(client));
    this.logger.debug({ msg: 'repo.upsertClient completed', clientId: result.id });
    return result;
  }

  /**
   * Registers a new user in the in-memory store (for password grant).
   * @param username - Login identifier.
   * @param password - Plain password stored for demo comparison.
   * @param scopes - Optional default scopes for the user.
   * @returns The created or updated OAuth user.
   */
  async registerUser(username: string, password: string, scopes?: string[]): Promise<OAuthUser> {
    const repo = this.getMutableRepo();
    if (!repo) {
      throw new BadRequestException('Auth repository does not support mutations');
    }
    const user: OAuthUser & { password?: string } = {
      id: username,
      username,
      password,
      scope: scopes,
    };
    return Promise.resolve(repo.upsertUser(user));
  }

  /**
   * Validates the x-api-key header value via the repository (single data conduit).
   * @param apiKey - Value from the request header.
   * @throws {UnauthorizedException} When the key is missing or does not match.
   */
  validateApiKey(apiKey?: string): void {
    this.logger.debug({ msg: 'validateApiKey called', hasApiKey: Boolean(apiKey) });
    const valid = this.authRepository.validateApiKey?.(apiKey);
    if (!valid) {
      this.logger.warn({ msg: 'validateApiKey failed: invalid or missing API key' });
      throw new UnauthorizedException('Invalid API key');
    }
  }

  /**
   * Seeds the repository with a demo client and user for e2e and manual testing.
   * Skipped when using Strapi (data is managed by control-plane seed-oauth), to avoid duplicate/validation errors.
   */
  private seed(): void {
    const repo = this.getMutableRepo(false);
    if (!repo) return;
    if ((this.authRepository as any)?.constructor?.name === 'StrapiOAuthRepository') {
      this.logger.debug({ msg: 'seed skipped: Strapi repository (use control-plane seed-oauth)' });
      return;
    }
    void Promise.resolve(
      repo.upsertClient({
        id: 'demo-client',
        clientSecret: 'demo-secret',
        grants: ['password', 'client_credentials', 'refresh_token'],
        scope: ['read', 'write'],
        userId: 'demo',
      }),
    ).catch((err: unknown) => {
      this.logger.warn({ msg: 'seed upsertClient failed', error: err instanceof Error ? err.message : String(err) });
    });
    void Promise.resolve(
      repo.upsertUser({
        id: 'demo',
        username: 'demo',
        password: 'demo',
        scope: ['read', 'write'],
      }),
    ).catch((err: unknown) => {
      this.logger.warn({ msg: 'seed upsertUser failed', error: err instanceof Error ? err.message : String(err) });
    });
  }

  private getMutableRepo(throwIfMissing = true): {
    upsertClient: (client: OAuthClient) => OAuthClient | Promise<OAuthClient>;
    upsertUser: (user: OAuthUser & { password?: string }) => OAuthUser | Promise<OAuthUser>;
  } | null {
    const repo = this.authRepository as any;
    const hasUpsertClient = repo && typeof repo.upsertClient === 'function';
    const hasUpsertUser = repo && typeof repo.upsertUser === 'function';
    const supportsMutations = hasUpsertClient && hasUpsertUser;
    this.logger.debug({
      msg: 'getMutableRepo',
      repoType: repo?.constructor?.name ?? 'unknown',
      hasUpsertClient,
      hasUpsertUser,
      supportsMutations,
      throwIfMissing,
    });
    if (supportsMutations) {
      return repo;
    }
    if (throwIfMissing) {
      this.logger.warn({
        msg: 'getMutableRepo: repository does not support mutations',
        repoType: repo?.constructor?.name ?? 'unknown',
      });
      throw new BadRequestException('Auth repository does not support mutations');
    }
    return null;
  }
}
