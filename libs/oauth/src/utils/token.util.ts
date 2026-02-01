import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure random token string.
 * @returns Hex-encoded random token.
 */
export async function generateRandomToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    randomBytes(32, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data.toString('hex'));
    });
  });
}
