import { HttpStatus } from '@nestjs/common';
import { UmojaException } from './umoja.exception';

describe('UmojaException', () => {
  it('builds response with message and code', () => {
    const error = new UmojaException('Boom', HttpStatus.BAD_REQUEST, 'BAD_REQUEST');
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual({ message: 'Boom', code: 'BAD_REQUEST' });
  });

  it('uses error as cause and inner', () => {
    const inner = new Error('Inner');
    const error = new UmojaException(inner, HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR');
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.getResponse()).toEqual({ message: 'Inner', code: 'INTERNAL_SERVER_ERROR' });
    expect(error.inner).toBe(inner);
  });

  it('accepts explicit cause', () => {
    const inner = new Error('Inner');
    const error = new UmojaException('Boom', HttpStatus.BAD_REQUEST, 'BAD_REQUEST', inner);
    expect(error.inner).toBe(inner);
  });
});
