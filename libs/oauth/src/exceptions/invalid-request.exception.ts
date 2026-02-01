import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when the request is malformed or missing parameters.
 */
export class InvalidRequestException extends UmojaException {
  /**
   * Create an InvalidRequestException.
   *
   * @param message - Custom message (defaults to "Invalid request").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid request', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_REQUEST', innerException);
  }
}
