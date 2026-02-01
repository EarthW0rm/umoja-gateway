import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when an unexpected server error occurs.
 */
export class ServerException extends UmojaException {
  /**
   * Create a ServerException.
   *
   * @param message - Custom message (defaults to "Server error").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Server error', innerException?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, 'SERVER_ERROR', innerException);
  }
}
