import { Controller, Get } from '@nestjs/common';
import { UmojaApiService } from './umoja-api.service';

@Controller()
export class UmojaApiController {
  constructor(private readonly umojaApiService: UmojaApiService) {}

  @Get()
  getHello(): string {
    return this.umojaApiService.getHello();
  }
}
