import {
  AccessDeniedException,
  InsufficientScopeException,
  InvalidArgumentException,
  InvalidClientException,
  InvalidGrantException,
  InvalidRequestException,
  InvalidScopeException,
  InvalidTokenException,
  OAuthException,
  ServerException,
  UnauthorizedClientException,
  UnauthorizedRequestException,
  UnsupportedGrantTypeException,
  UnsupportedResponseTypeException,
} from './index';
import { HttpStatus } from '@nestjs/common';

describe('OAuth exceptions', () => {
  const cases = [
    [AccessDeniedException, HttpStatus.FORBIDDEN, 'Access denied', 'ACCESS_DENIED'],
    [InsufficientScopeException, HttpStatus.FORBIDDEN, 'Insufficient scope', 'INSUFFICIENT_SCOPE'],
    [InvalidArgumentException, HttpStatus.BAD_REQUEST, 'Invalid argument', 'INVALID_ARGUMENT'],
    [InvalidClientException, HttpStatus.UNAUTHORIZED, 'Invalid client', 'INVALID_CLIENT'],
    [InvalidGrantException, HttpStatus.BAD_REQUEST, 'Invalid grant', 'INVALID_GRANT'],
    [InvalidRequestException, HttpStatus.BAD_REQUEST, 'Invalid request', 'INVALID_REQUEST'],
    [InvalidScopeException, HttpStatus.BAD_REQUEST, 'Invalid scope', 'INVALID_SCOPE'],
    [InvalidTokenException, HttpStatus.UNAUTHORIZED, 'Invalid token', 'INVALID_TOKEN'],
    [ServerException, HttpStatus.INTERNAL_SERVER_ERROR, 'Server error', 'SERVER_ERROR'],
    [UnauthorizedClientException, HttpStatus.UNAUTHORIZED, 'Unauthorized client', 'UNAUTHORIZED_CLIENT'],
    [UnauthorizedRequestException, HttpStatus.UNAUTHORIZED, 'Unauthorized request', 'UNAUTHORIZED_REQUEST'],
    [UnsupportedGrantTypeException, HttpStatus.BAD_REQUEST, 'Unsupported grant type', 'UNSUPPORTED_GRANT_TYPE'],
    [UnsupportedResponseTypeException, HttpStatus.BAD_REQUEST, 'Unsupported response type', 'UNSUPPORTED_RESPONSE_TYPE'],
    [OAuthException, HttpStatus.INTERNAL_SERVER_ERROR, 'OAuth error', 'OAUTH_ERROR'],
  ] as const;

  it.each(cases)('sets status and response for %p', (Type, status, message, code) => {
    const error = new Type();
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toEqual({ message, code });
  });

  it('preserves inner exception', () => {
    const inner = new Error('Inner');
    const error = new InvalidRequestException(inner.message, inner);
    expect(error.inner).toBe(inner);
  });
});
