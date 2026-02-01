import { Module } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { AUTH_EXPECTED_API_KEY } from './auth.tokens';
import { InMemoryAuthRepository } from './in-memory-auth.repository';

/**
 * Module that provides the OAuth repository implementation (AUTH_REPOSITORY).
 * Uses InMemoryAuthRepository for demo; replace with a persistent implementation for production.
 * AUTH_EXPECTED_API_KEY defaults to 'changeme'; provide from ConfigService in production.
 */
@Module({
  providers: [
    { provide: AUTH_EXPECTED_API_KEY, useValue: 'changeme' },
    InMemoryAuthRepository,
    {
      provide: AUTH_REPOSITORY,
      useExisting: InMemoryAuthRepository,
    },
  ],
  exports: [AUTH_REPOSITORY],
})
export class AuthModelModule {}
