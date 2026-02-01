import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when a grant is invalid or expired.
 */
export class InvalidGrantException extends UmojaException {
  /**
   * Create an InvalidGrantException.
   *
   * @param message - Custom message (defaults to "Invalid grant").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid grant', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_GRANT', innerException);
  }
}
