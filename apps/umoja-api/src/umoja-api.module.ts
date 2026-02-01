import { Module } from '@nestjs/common';
import { UmojaApiController } from './umoja-api.controller';
import { UmojaApiService } from './umoja-api.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UmojaApiController],
  providers: [UmojaApiService],
})
export class UmojaApiModule {}
