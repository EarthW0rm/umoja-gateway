import { Controller, Get } from '@nestjs/common';
import { UmojaApiService } from './umoja-api.service';

/**
 * Root controller for the Umoja API. Exposes a simple health/hello endpoint.
 */
@Controller()
export class UmojaApiController {
  /**
   * Creates the root API controller.
   * @param umojaApiService Injected service that provides greeting logic.
   */
  constructor(private readonly umojaApiService: UmojaApiService) {}

  /**
   * Returns a greeting string from the API.
   * @returns Hello message.
   */
  @Get()
  getHello(): string {
    return this.umojaApiService.getHello();
  }
}
