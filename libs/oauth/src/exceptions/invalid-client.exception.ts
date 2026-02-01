import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when client authentication fails.
 */
export class InvalidClientException extends UmojaException {
  /**
   * Create an InvalidClientException.
   *
   * @param message - Custom message (defaults to "Invalid client").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid client', innerException?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, 'INVALID_CLIENT', innerException);
  }
}
