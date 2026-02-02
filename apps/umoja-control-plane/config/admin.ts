export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    sessions: {
      /**
       * Maximum lifespan for admin session cookies (relative expiry).
       */
      maxSessionLifespan: env('ADMIN_SESSION_MAX_LIFESPAN', '1d'),
      /**
       * Maximum lifespan for admin refresh tokens (absolute expiry).
       */
      maxRefreshTokenLifespan: env('ADMIN_REFRESH_MAX_LIFESPAN', '30d'),
    },
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
