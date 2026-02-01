import { createHash as nodeCreateHash } from 'crypto';
import type { BinaryLike, BinaryToTextEncoding } from 'crypto';

export function createHash({
  algorithm = 'sha256',
  data,
  output,
  encoding,
}: {
  algorithm?: string;
  data: BinaryLike;
  output?: BinaryToTextEncoding;
  encoding?: BufferEncoding;
}): Buffer | string {
  const hash = nodeCreateHash(algorithm);
  if (typeof data === 'string' && encoding) {
    hash.update(data, encoding);
  } else if (typeof data === 'string') {
    hash.update(data);
  } else {
    hash.update(data);
  }

  return output ? hash.digest(output) : hash.digest();
}
