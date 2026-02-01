import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when the access token scope is insufficient.
 */
export class InsufficientScopeException extends UmojaException {
  /**
   * Create an InsufficientScopeException.
   *
   * @param message - Custom message (defaults to "Insufficient scope").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Insufficient scope', innerException?: Error) {
    super(message, HttpStatus.FORBIDDEN, 'INSUFFICIENT_SCOPE', innerException);
  }
}
