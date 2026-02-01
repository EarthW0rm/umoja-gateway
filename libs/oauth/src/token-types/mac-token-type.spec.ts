import { MacTokenType } from './mac-token-type';
import { ServerException } from '../exceptions';

describe('MacTokenType', () => {
  it('throws not implemented error', () => {
    expect(() => new MacTokenType()).toThrow(ServerException);
  });
});
