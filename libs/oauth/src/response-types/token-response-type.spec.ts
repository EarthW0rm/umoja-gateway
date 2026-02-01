import { TokenResponseType } from './token-response-type';
import { ServerException } from '../exceptions';

describe('TokenResponseType', () => {
  it('throws not implemented', () => {
    expect(() => new TokenResponseType()).toThrow(ServerException);
  });
});
