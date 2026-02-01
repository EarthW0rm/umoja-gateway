import { Module } from '@nestjs/common';
import { InMemoryAuthRepository } from './in-memory-auth.repository';
import { AUTH_REPOSITORY } from '@oauth/oauth';

@Module({
  providers: [
    InMemoryAuthRepository,
    {
      provide: AUTH_REPOSITORY,
      useExisting: InMemoryAuthRepository,
    },
  ],
  exports: [AUTH_REPOSITORY],
})
export class AuthModelModule {}
