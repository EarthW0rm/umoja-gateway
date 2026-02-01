import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when the response type is unsupported.
 */
export class UnsupportedResponseTypeException extends UmojaException {
  /**
   * Create an UnsupportedResponseTypeException.
   *
   * @param message - Custom message (defaults to "Unsupported response type").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Unsupported response type', innerException?: Error) {
    super(message, HttpStatus.BAD_REQUEST, 'UNSUPPORTED_RESPONSE_TYPE', innerException);
  }
}
