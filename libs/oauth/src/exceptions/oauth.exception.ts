import { HttpStatus } from '@nestjs/common';
import { UmojaException } from '@core/core';

/**
 * Base OAuth exception for generic OAuth errors.
 */
export class OAuthException extends UmojaException {
  /**
   * Create an OAuthException.
   *
   * @param message - Custom message (defaults to "OAuth error").
   * @param innerException - Optional nested error reference.
   */
  constructor(message: string = 'OAuth error', innerException?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, 'OAUTH_ERROR', innerException);
  }
}
