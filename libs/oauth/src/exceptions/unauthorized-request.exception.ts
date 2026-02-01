import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when a protected resource request lacks authorization.
 */
export class UnauthorizedRequestException extends UmojaException {
  /**
   * Create an UnauthorizedRequestException.
   *
   * @param message - Custom message (defaults to "Unauthorized request").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Unauthorized request', innerException?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED_REQUEST', innerException);
  }
}
