import { InvalidArgumentException, InvalidScopeException } from '../exceptions';
import { generateRandomToken, buildAccessTokenPayload, signAccessTokenJwt } from '../utils';
import { parseScope } from '../utils/scope.util';
import type { JwtTokenOptions, OAuthClient, OAuthUser } from '../interfaces';

/**
 * Base grant type with shared token generation utilities.
 */
export abstract class AbstractGrantType {
  protected accessTokenLifetime: number;
  protected refreshTokenLifetime?: number;
  protected alwaysIssueNewRefreshToken?: boolean;
  protected authRepository: Record<string, any>;
  protected jwtOptions?: JwtTokenOptions;

  /**
   * Initializes grant type with required lifetimes and auth repository hooks.
   * @param options Input payload defining lifetimes and repository hooks.
   * @throws {InvalidArgumentException} When required options are missing.
   */
  constructor(options: {
    accessTokenLifetime: number;
    authRepository: Record<string, any>;
    refreshTokenLifetime?: number;
    alwaysIssueNewRefreshToken?: boolean;
    jwtOptions?: JwtTokenOptions;
  }) {
    if (!options.accessTokenLifetime) {
      throw new InvalidArgumentException('Missing parameter: `accessTokenLifetime`');
    }

    if (!options.authRepository) {
      throw new InvalidArgumentException('Missing parameter: `authRepository`');
    }

    this.accessTokenLifetime = options.accessTokenLifetime;
    this.authRepository = options.authRepository;
    this.refreshTokenLifetime = options.refreshTokenLifetime;
    this.alwaysIssueNewRefreshToken = options.alwaysIssueNewRefreshToken;
    this.jwtOptions = options.jwtOptions;
  }

  /**
   * Generates an access token using JWT or repository hook.
   * @param client Input payload representing the OAuth client.
   * @param user Input payload representing the resource owner.
   * @param scope Optional scope array.
   * @returns Access token string.
   */
  async generateAccessToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    if (this.jwtOptions && (this.jwtOptions.privateKey || this.jwtOptions.secret)) {
      const payload = buildAccessTokenPayload({
        client,
        user,
        scope,
      });
      const resolvedAudience = await this.resolveAudience(client, user, scope);
      return signAccessTokenJwt(payload, { ...this.jwtOptions, audience: resolvedAudience }, this.accessTokenLifetime);
    }

    if (this.authRepository.generateAccessToken) {
      return this.authRepository.generateAccessToken(client, user, scope);
    }

    return generateRandomToken();
  }

  /**
   * Generates a refresh token using repository hook or random token.
   * @param client Input payload representing the OAuth client.
   * @param user Input payload representing the resource owner.
   * @param scope Optional scope array.
   * @returns Refresh token string.
   */
  async generateRefreshToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    if (this.authRepository.generateRefreshToken) {
      return this.authRepository.generateRefreshToken(client, user, scope);
    }

    return generateRandomToken();
  }

  /**
   * Computes the expiration date for an access token.
   * @returns Expiration date.
   */
  getAccessTokenExpiresAt(): Date {
    return new Date(Date.now() + this.accessTokenLifetime * 1000);
  }

  /**
   * Computes the expiration date for a refresh token.
   * @returns Expiration date.
   */
  getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + (this.refreshTokenLifetime ?? 0) * 1000);
  }

  /**
   * Parses scope from the request payload.
   * @param request Input payload containing optional scope.
   * @returns Scope as array or undefined.
   */
  getScope(request: { body?: Record<string, unknown> }): string[] | undefined {
    return parseScope(request.body?.scope as string | undefined);
  }

  /**
   * Validates scope using repository hook when available.
   * @param user Input payload representing the resource owner.
   * @param client Input payload representing the OAuth client.
   * @param scope Requested scope array.
   * @returns Validated scope array.
   * @throws {InvalidScopeException}
   */
  async validateScope(user: OAuthUser, client: OAuthClient, scope?: string[]) {
    if (this.authRepository.validateScope) {
      const validatedScope = await this.authRepository.validateScope(user, client, scope);
      if (!validatedScope) {
        throw new InvalidScopeException('Invalid scope: Requested scope is invalid');
      }
      return validatedScope;
    }

    return scope;
  }

  /**
   * Resolves JWT audience from repository or configuration.
   * @param client Input payload representing the OAuth client.
   * @param user Input payload representing the resource owner.
   * @param scope Requested scope array.
   * @returns Audience array or undefined.
   */
  private async resolveAudience(client: OAuthClient, user: OAuthUser, scope?: string[]) {
    const audienceFromRepo = await this.authRepository.getAudiences?.(client, user, scope);
    if (audienceFromRepo) {
      return normalizeAudience(audienceFromRepo);
    }
    if (this.jwtOptions?.audience) {
      return normalizeAudience(this.jwtOptions.audience);
    }
    return undefined;
  }
}

function normalizeAudience(aud: string | string[]) {
  return Array.isArray(aud) ? aud : [aud];
}
