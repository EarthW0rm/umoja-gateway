import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InMemoryAuthRepository } from './in-memory-auth.repository';
import type { OAuthClient, OAuthUser } from '@oauth/oauth';
import { AUTH_REPOSITORY } from '@oauth/oauth';

interface RegisterClientDto {
  name: string;
  grants?: string[];
  redirectUris?: string[];
  scopes?: string[];
  audiences?: string[];
  userId?: string;
}

@Injectable()
export class AuthExampleService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly model: InMemoryAuthRepository) {
    this.seed();
  }

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
    return this.model.upsertClient(client);
  }

  registerUser(username: string, password: string, scopes?: string[]): OAuthUser {
    const user: OAuthUser & { password?: string } = {
      id: username,
      username,
      password,
      scope: scopes,
    };
    return this.model.upsertUser(user);
  }

  validateApiKey(apiKey?: string) {
    const expected = process.env.API_KEY ?? 'changeme';
    if (apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  private seed() {
    if (!this.model) return;
    this.model.upsertClient({
      id: 'demo-client',
      clientSecret: 'demo-secret',
      grants: ['password', 'client_credentials', 'refresh_token'],
      scope: ['read', 'write'],
      userId: 'demo',
    });
    this.model.upsertUser({
      id: 'demo',
      username: 'demo',
      password: 'demo',
      scope: ['read', 'write'],
    });
  }
}
