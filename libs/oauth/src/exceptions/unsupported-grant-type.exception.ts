import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when the grant type is unsupported.
 */
export class UnsupportedGrantTypeException extends UmojaException {
  /**
   * Create an UnsupportedGrantTypeException.
   *
   * @param message - Custom message (defaults to "Unsupported grant type").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Unsupported grant type', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'UNSUPPORTED_GRANT_TYPE', innerException);
  }
}
