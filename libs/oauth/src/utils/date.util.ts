/**
 * Calculates token lifetime in seconds based on an expiration date.
 * @param expiresAt Expiration date instance.
 * @returns Lifetime in seconds.
 */
export function getLifetimeFromExpiresAt(expiresAt: Date): number {
  return Math.floor((expiresAt.getTime() - Date.now()) / 1000);
}
