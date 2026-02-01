import { Module } from '@nestjs/common';
import { UmojaApiController } from './umoja-api.controller';
import { UmojaApiService } from './umoja-api.service';

@Module({
  imports: [],
  controllers: [UmojaApiController],
  providers: [UmojaApiService],
})
export class UmojaApiModule {}
