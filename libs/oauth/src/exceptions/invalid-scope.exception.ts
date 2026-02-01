import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when requested scope is invalid.
 */
export class InvalidScopeException extends UmojaException {
  /**
   * Create an InvalidScopeException.
   *
   * @param message - Custom message (defaults to "Invalid scope").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Invalid scope', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_SCOPE', innerException);
  }
}
