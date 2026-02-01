import { InvalidArgumentException, InvalidScopeException } from '../exceptions';
import { generateRandomToken, buildAccessTokenPayload, signAccessTokenJwt } from '../utils';
import { parseScope } from '../utils/scope.util';
import type { JwtTokenOptions, OAuthClient, OAuthUser } from '../interfaces';

export abstract class AbstractGrantType {
  protected accessTokenLifetime: number;
  protected refreshTokenLifetime?: number;
  protected alwaysIssueNewRefreshToken?: boolean;
  protected model: Record<string, any>;
  protected jwtOptions?: JwtTokenOptions;

  constructor(options: {
    accessTokenLifetime: number;
    model: Record<string, any>;
    refreshTokenLifetime?: number;
    alwaysIssueNewRefreshToken?: boolean;
    jwtOptions?: JwtTokenOptions;
  }) {
    if (!options.accessTokenLifetime) {
      throw new InvalidArgumentException('Missing parameter: `accessTokenLifetime`');
    }

    if (!options.model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }

    this.accessTokenLifetime = options.accessTokenLifetime;
    this.model = options.model;
    this.refreshTokenLifetime = options.refreshTokenLifetime;
    this.alwaysIssueNewRefreshToken = options.alwaysIssueNewRefreshToken;
    this.jwtOptions = options.jwtOptions;
  }

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

    if (this.model.generateAccessToken) {
      return this.model.generateAccessToken(client, user, scope);
    }

    return generateRandomToken();
  }

  async generateRefreshToken(client: OAuthClient, user: OAuthUser, scope?: string[]): Promise<string> {
    if (this.model.generateRefreshToken) {
      return this.model.generateRefreshToken(client, user, scope);
    }

    return generateRandomToken();
  }

  getAccessTokenExpiresAt(): Date {
    return new Date(Date.now() + this.accessTokenLifetime * 1000);
  }

  getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + (this.refreshTokenLifetime ?? 0) * 1000);
  }

  getScope(request: { body?: Record<string, unknown> }): string[] | undefined {
    return parseScope(request.body?.scope as string | undefined);
  }

  async validateScope(user: OAuthUser, client: OAuthClient, scope?: string[]) {
    if (this.model.validateScope) {
      const validatedScope = await this.model.validateScope(user, client, scope);
      if (!validatedScope) {
        throw new InvalidScopeException('Invalid scope: Requested scope is invalid');
      }
      return validatedScope;
    }

    return scope;
  }

  private async resolveAudience(client: OAuthClient, user: OAuthUser, scope?: string[]) {
    const audienceFromRepo = await this.model.getAudiences?.(client, user, scope);
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
