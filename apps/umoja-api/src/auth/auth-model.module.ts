import { Module } from '@nestjs/common';
import { InMemoryOAuthModel } from './auth.model';

@Module({
  providers: [InMemoryOAuthModel],
  exports: [InMemoryOAuthModel],
})
export class AuthModelModule {}
