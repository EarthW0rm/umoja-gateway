import { randomUUID } from 'crypto';
import { sign, verify, type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import type { JwtTokenOptions, OAuthClient, OAuthToken, OAuthUser } from '../interfaces';

/**
 * Output model representing claims stored in OAuth access token JWTs.
 */
export interface AccessTokenJwtPayload extends JwtPayload {
  /**
   * Client identifier claim.
   */
  cid: string;
  /**
   * Authorized scopes encoded in the token.
   */
  scope?: string[] | string;
  /**
   * Sanitized user attributes.
   */
  user?: Record<string, unknown>;
  /**
   * Sanitized client attributes.
   */
  client?: Record<string, unknown>;
}

/**
 * Builds a sanitized JWT payload for access tokens.
 * @param params - Client, user and scopes to embed in the token.
 * @returns Payload ready to be signed.
 */
export function buildAccessTokenPayload(params: {
  client: OAuthClient;
  user: OAuthUser;
  scope?: string[];
}): AccessTokenJwtPayload {
  const userId = params.user?.id ?? (params.user as { username?: string })?.username;

  if (!userId) {
    throw new Error('Cannot issue access token without a user identifier');
  }

  if (!params.client?.id) {
    throw new Error('Cannot issue access token without a client identifier');
  }

  return {
    sub: String(userId),
    cid: String(params.client.id),
    scope: params.scope,
    user: sanitizeUser(params.user),
    client: sanitizeClient(params.client),
  };
}

/**
 * Signs a JWT access token with issuer/audience enforcement.
 * @param payload - Prepared payload to sign.
 * @param options - JWT configuration.
 * @param lifetimeSeconds - Expiration window in seconds.
 * @returns Signed JWT string.
 */
export function signAccessTokenJwt(
  payload: AccessTokenJwtPayload,
  options: JwtTokenOptions,
  lifetimeSeconds: number,
): string {
  const signingKey = options.privateKey ?? options.secret;

  if (!signingKey) {
    throw new Error('JWT signing key is missing');
  }

  const signOptions: SignOptions = {
    algorithm: options.algorithm ?? (options.privateKey ? 'RS256' : 'HS256'),
    issuer: options.issuer,
    audience: options.audience,
    keyid: options.keyId,
    expiresIn: lifetimeSeconds,
    jwtid: payload.jti ?? randomUUID(),
  };

  return sign(payload, signingKey, signOptions);
}

/**
 * Verifies a JWT access token and returns its payload.
 * @param token - Raw JWT string.
 * @param options - JWT configuration.
 * @returns Decoded payload if the signature and claims are valid.
 */
export function verifyAccessTokenJwt(token: string, options: JwtTokenOptions): AccessTokenJwtPayload {
  const verificationKey = options.publicKey ?? options.secret ?? options.privateKey;

  if (!verificationKey) {
    throw new Error('JWT verification key is missing');
  }

  const audience = Array.isArray(options.audience) ? [...options.audience] : options.audience;

  const verifyOptions: VerifyOptions = {
    algorithms: options.algorithm ? [options.algorithm] : undefined,
    issuer: options.issuer,
    audience: audience as VerifyOptions['audience'],
    clockTolerance: options.clockToleranceSeconds,
  };

  return verify(token, verificationKey, verifyOptions) as AccessTokenJwtPayload;
}

/**
 * Maps a JWT payload back to the OAuth token structure expected by the handlers.
 * @param token - Raw JWT string.
 * @param payload - Verified JWT payload.
 * @returns OAuthToken with expiration and principal metadata.
 */
export function mapPayloadToOAuthToken(token: string, payload: AccessTokenJwtPayload): OAuthToken {
  if (!payload.exp) {
    throw new Error('JWT access token is missing exp claim');
  }

  if (!payload.sub) {
    throw new Error('JWT access token is missing sub claim');
  }

  const accessTokenExpiresAt = new Date(payload.exp * 1000);
  const scopeClaim = payload.scope as string[] | string | undefined;
  const audienceClaim = payload.aud as string[] | string | undefined;
  const scope = Array.isArray(scopeClaim)
    ? scopeClaim
    : typeof scopeClaim === 'string'
      ? scopeClaim.split(' ')
      : undefined;
  const audience = Array.isArray(audienceClaim)
    ? audienceClaim
    : typeof audienceClaim === 'string'
      ? audienceClaim.split(' ')
      : undefined;

  const user =
    (payload.user as OAuthUser | undefined) ??
    ({
      id: payload.sub,
    } as OAuthUser);

  const client =
    (payload.client as OAuthClient | undefined) ??
    ({
      id: payload.cid,
    } as OAuthClient);

  return {
    accessToken: token,
    accessTokenExpiresAt,
    scope,
    user,
    client,
    audience,
  } as OAuthToken;
}

/**
 * Sanitizes user object for JWT payload (strips password).
 * @internal Exported for testing branch coverage.
 */
export function sanitizeUser(user: OAuthUser): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user ?? {})) {
    if (key === 'password') {
      continue;
    }
    clone[key] = value;
  }
  if (!clone.id && (user as { username?: string })?.username) {
    clone.id = (user as { username?: string }).username;
  }
  return clone;
}

/**
 * Sanitizes client object for JWT payload (strips clientSecret).
 * @internal Exported for testing branch coverage.
 */
export function sanitizeClient(client: OAuthClient): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client ?? {})) {
    if (key === 'clientSecret') {
      continue;
    }
    clone[key] = value;
  }
  if (!clone.id && client?.id) {
    clone.id = client.id;
  }
  return clone;
}
