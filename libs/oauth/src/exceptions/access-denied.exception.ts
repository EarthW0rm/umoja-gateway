import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Thrown when a resource owner denies access.
 */
export class AccessDeniedException extends UmojaException {
  /**
   * Create an AccessDeniedException.
   * @param message - Human-readable message (default: "Access denied").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'Access denied', innerException?: Error) {
    super(message, HttpStatus.FORBIDDEN, 'ACCESS_DENIED', innerException);
  }
}
