export function getLifetimeFromExpiresAt(expiresAt: Date): number {
  return Math.floor((expiresAt.getTime() - Date.now()) / 1000);
}
