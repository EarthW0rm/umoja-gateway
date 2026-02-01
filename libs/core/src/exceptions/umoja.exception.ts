import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for Umoja modules.
 *
 * Wraps a standardized response payload with a `message` and `code`,
 * and preserves nested errors via `cause` and the `inner` alias.
 */
export class UmojaException extends HttpException {
  /**
   * Nested exception reference (alias for `cause`).
   */
  inner?: Error;

  /**
   * Create a new UmojaException.
   *
   * @param messageOrError - Message string or nested error.
   * @param status - HTTP status for the response.
   * @param code - Application error code identifier.
   * @param cause - Optional nested error reference.
   */
  constructor(
    messageOrError: string | Error,
    status = HttpStatus.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_SERVER_ERROR',
    cause?: Error,
  ) {
    const _message = messageOrError instanceof Error ? messageOrError.message : messageOrError;
    const _cause = messageOrError instanceof Error ? messageOrError : cause;
    super(
      {
        message: _message,
        code,
      },
      status,
      _cause ? { cause: _cause } : undefined,
    );
    this.inner = _cause;
  }
}
