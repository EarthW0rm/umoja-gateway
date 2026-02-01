import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when an access token is invalid or expired.
 */
export class InvalidTokenException extends UmojaException {
  /**
   * Create an InvalidTokenException.
   *
   * @param message - Custom message (defaults to "Invalid token").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid token', innerException?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, 'INVALID_TOKEN', innerException);
  }
}
