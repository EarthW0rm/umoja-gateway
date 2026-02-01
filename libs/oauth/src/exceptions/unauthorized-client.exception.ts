import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when the client is not authorized to perform an action.
 */
export class UnauthorizedClientException extends UmojaException {
  /**
   * Create an UnauthorizedClientException.
   *
   * @param message - Custom message (defaults to "Unauthorized client").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Unauthorized client', innerException?: Error) {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED_CLIENT', innerException);
  }
}
