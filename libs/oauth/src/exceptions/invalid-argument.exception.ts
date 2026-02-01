import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when required arguments are missing or invalid.
 */
export class InvalidArgumentException extends UmojaException {
  /**
   * Create an InvalidArgumentException.
   *
    * @param message - Custom message (defaults to "Invalid argument").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid argument', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_ARGUMENT', innerException);
  }
}
