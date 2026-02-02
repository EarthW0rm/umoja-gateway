import { Module, DynamicModule } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { AUTH_EXPECTED_API_KEY } from './auth.tokens';
import { InMemoryAuthRepository } from './in-memory-auth.repository';

/**
 * Control Plane module exposing the in-memory AuthRepository implementation (demo/testing).
 */
@Module({})
export class ControlPlaneInMemoryModule {
  /**
   * Registers the in-memory repository with an optional expected API key.
   * @param expectedApiKey - Value to compare with x-api-key header.
   * @returns Dynamic module providing AUTH_REPOSITORY.
   */
  static register(expectedApiKey = 'changeme'): DynamicModule {
    return {
      module: ControlPlaneInMemoryModule,
      providers: [
        { provide: AUTH_EXPECTED_API_KEY, useValue: expectedApiKey },
        InMemoryAuthRepository,
        { provide: AUTH_REPOSITORY, useExisting: InMemoryAuthRepository },
      ],
      exports: [AUTH_REPOSITORY, InMemoryAuthRepository, AUTH_EXPECTED_API_KEY],
    };
  }
}
