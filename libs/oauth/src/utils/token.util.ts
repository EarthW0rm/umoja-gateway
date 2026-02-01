import { randomBytes } from 'crypto';

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
