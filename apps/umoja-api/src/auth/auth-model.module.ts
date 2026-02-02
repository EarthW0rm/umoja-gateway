import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import {
  ControlPlaneStrapiModule,
  ControlPlaneInMemoryModule,
  InMemoryAuthRepository,
  StrapiOAuthRepository,
} from '@control-plane/control-plane';

const useInMemory =
  process.env.USE_IN_MEMORY_AUTH === 'true' || process.env.NODE_ENV === 'test';

/**
 * Module that provides the OAuth repository implementation (AUTH_REPOSITORY).
 * Wires the Strapi-backed or in-memory repository from the control plane.
 * Declares AUTH_REPOSITORY as a local provider (useExisting) so Nest validates exports.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    useInMemory
      ? ControlPlaneInMemoryModule.register(process.env.AUTH_EXPECTED_API_KEY ?? 'changeme')
      : ControlPlaneStrapiModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            baseUrl: config.getOrThrow<string>('CONTROL_PLANE_STRAPI_BASE_URL'),
            apiToken: config.getOrThrow<string>('CONTROL_PLANE_STRAPI_API_TOKEN'),
            timeoutMs: config.get<number>('CONTROL_PLANE_HTTP_TIMEOUT') ?? 5000,
          }),
        }),
  ],
  providers: [
    useInMemory
      ? { provide: AUTH_REPOSITORY, useExisting: InMemoryAuthRepository }
      : { provide: AUTH_REPOSITORY, useExisting: StrapiOAuthRepository },
  ],
  exports: [AUTH_REPOSITORY],
})
export class AuthModelModule {}
