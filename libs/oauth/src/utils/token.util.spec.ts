import { generateRandomToken } from './token.util';

describe('token.util', () => {
  it('generates a hex token of 64 characters (32 bytes)', async () => {
    const token = await generateRandomToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('rejects when randomBytes fails', async () => {
    const crypto = require('crypto');
    const spy = jest.spyOn(crypto, 'randomBytes').mockImplementation((_size: number, cb: (err: Error | null, buf: any) => void) => {
      cb(new Error('fail'), null);
      return null as any;
    });
    await expect(generateRandomToken()).rejects.toBeInstanceOf(Error);
    spy.mockRestore();
  });
});
