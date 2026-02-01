/**
 * Encodes a buffer or string using URL-safe base64 without padding.
 * @param value Input payload to encode.
 * @returns URL-safe base64 string.
 */
export function base64URLEncode(value: Buffer | string): string {
  const bufferValue = typeof value === 'string' ? Buffer.from(value) : value;
  return bufferValue
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
