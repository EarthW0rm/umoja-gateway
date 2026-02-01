import { Module } from '@nestjs/common';
import { UmojaApiController } from './umoja-api.controller';
import { UmojaApiService } from './umoja-api.service';
import { AuthModule } from './auth/auth.module';

/**
 * Root application module for the Umoja API (BFF).
 * Imports AuthModule for OAuth and demo auth routes; exposes UmojaApiController and UmojaApiService.
 */
@Module({
  imports: [AuthModule],
  controllers: [UmojaApiController],
  providers: [UmojaApiService],
})
export class UmojaApiModule {}
