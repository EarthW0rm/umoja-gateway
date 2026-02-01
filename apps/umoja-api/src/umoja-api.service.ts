import { Injectable } from '@nestjs/common';

/**
 * Root application service for the Umoja API. Provides simple greeting logic.
 */
@Injectable()
export class UmojaApiService {
  /**
   * Returns a static greeting message.
   * @returns Hello World string.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
