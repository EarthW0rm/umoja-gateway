import { Inject, Injectable } from '@nestjs/common';
import { isFormat } from '../utils/formats.util';
import {
  InvalidArgumentException,
  InvalidGrantException,
  InvalidRequestException,
  ServerException,
} from '../exceptions';
import { getHashForCodeChallenge } from '../utils/pkce/pkce.util';
import type { AuthorizationCode, OAuthClient, OAuthToken, OAuthUser, AuthorizationCodeModel } from '../interfaces';
import { AbstractGrantType } from './abstract-grant-type';
import { AUTH_REPOSITORY, OAUTH2_SERVER_OPTIONS } from '../config/oauth.tokens';
import type { ServerOptions } from '../interfaces';
import { resolveTokenOptions } from '../utils';

/**
 * Implements the authorization_code grant type with PKCE support.
 */
@Injectable()
export class AuthorizationCodeGrantType extends AbstractGrantType {
  /**
   * Creates an authorization code grant handler.
   * @param options Input payload containing token lifetimes.
   * @param oauthRepository Input payload repository implementing authorization code storage.
   * @throws {InvalidArgumentException} When repository requirements are not met.
   */
  constructor(
    @Inject(OAUTH2_SERVER_OPTIONS)
    options: ServerOptions,
    @Inject(AUTH_REPOSITORY) oauthRepository: AuthorizationCodeModel,
  ) {
    const tokenOptions = resolveTokenOptions(options);
    const model = oauthRepository as AuthorizationCodeModel;
    const merged = {
      accessTokenLifetime: tokenOptions.accessTokenLifetime ?? 60 * 60,
      refreshTokenLifetime: tokenOptions.refreshTokenLifetime ?? 60 * 60 * 24 * 14,
      model,
      alwaysIssueNewRefreshToken: tokenOptions.alwaysIssueNewRefreshToken ?? true,
      jwtOptions: tokenOptions.jwt,
    };
    if (!model) {
      throw new InvalidArgumentException('Missing parameter: `model`');
    }

    if (!model.getAuthorizationCode) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `getAuthorizationCode()`');
    }

    if (!model.revokeAuthorizationCode) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `revokeAuthorizationCode()`');
    }

    if (!model.saveToken) {
      throw new InvalidArgumentException('Invalid argument: model does not implement `saveToken()`');
    }

    super(merged);
  }

  /**
   * Exchanges an authorization code for tokens.
   * @param request Input payload containing code and optional redirect.
   * @param client Input payload representing the OAuth client.
   * @returns Persisted token model.
   * @throws {InvalidArgumentException | InvalidGrantException | InvalidRequestException | ServerException}
   */
  async handle(request: { body: Record<string, unknown>; query?: Record<string, string> }, client: OAuthClient) {
    if (!request) {
      throw new InvalidArgumentException('Missing parameter: `request`');
    }

    if (!client) {
      throw new InvalidArgumentException('Missing parameter: `client`');
    }

    const code = await this.getAuthorizationCode(request, client);
    await this.revokeAuthorizationCode(code);
    this.validateRedirectUri(request, code);

    return this.saveToken(code.user, client, code.authorizationCode, code.scope);
  }

  /**
   * Retrieves and validates the authorization code from storage.
   * @param request Input payload containing code and verifier.
   * @param client Input payload representing the OAuth client.
   * @returns The validated authorization code model.
   * @throws {InvalidRequestException | InvalidGrantException | ServerException}
   */
  async getAuthorizationCode(
    request: { body: Record<string, unknown> },
    client: OAuthClient,
  ): Promise<AuthorizationCode> {
    const codeValue = request.body.code as string | undefined;
    if (!codeValue) {
      throw new InvalidRequestException('Missing parameter: `code`');
    }

    if (!isFormat.vschar(codeValue)) {
      throw new InvalidRequestException('Invalid parameter: `code`');
    }

    const code = await this.model.getAuthorizationCode(codeValue);
    if (!code) {
      throw new InvalidGrantException('Invalid grant: authorization code is invalid');
    }

    if (!code.client) {
      throw new ServerException('Server error: `getAuthorizationCode()` did not return a `client` object');
    }

    if (!code.user) {
      throw new ServerException('Server error: `getAuthorizationCode()` did not return a `user` object');
    }

    if (code.client.id !== client.id) {
      throw new InvalidGrantException('Invalid grant: authorization code is invalid');
    }

    if (!(code.expiresAt instanceof Date)) {
      throw new ServerException('Server error: `expiresAt` must be a Date instance');
    }

    if (code.expiresAt < new Date()) {
      throw new InvalidGrantException('Invalid grant: authorization code has expired');
    }

    if (code.redirectUri && !isFormat.uri(code.redirectUri)) {
      throw new InvalidGrantException('Invalid grant: `redirect_uri` is not a valid URI');
    }

    if (code.codeChallenge) {
      const verifier = request.body.code_verifier as string | undefined;
      if (!verifier) {
        throw new InvalidGrantException('Missing parameter: `code_verifier`');
      }

      const hash = getHashForCodeChallenge({
        method: code.codeChallengeMethod,
        verifier,
      });

      if (!hash) {
        throw new ServerException(
          'Server error: `getAuthorizationCode()` did not return a valid `codeChallengeMethod` property',
        );
      }

      if (code.codeChallenge !== hash) {
        throw new InvalidGrantException('Invalid grant: code verifier is invalid');
      }
    } else if (request.body.code_verifier) {
      throw new InvalidGrantException('Invalid grant: code verifier is invalid');
    }

    return code;
  }

  /**
   * Validates redirect URI consistency between request and stored code.
   * @param request Input payload containing redirect URI.
   * @param code Input payload representing the authorization code model.
   * @throws {InvalidRequestException}
   */
  validateRedirectUri(request: { body: Record<string, unknown>; query?: Record<string, string> }, code: AuthorizationCode) {
    if (!code.redirectUri) {
      return;
    }

    const redirectUri =
      (request.body.redirect_uri as string | undefined) ?? request.query?.redirect_uri ?? undefined;

    if (!redirectUri || !isFormat.uri(redirectUri)) {
      throw new InvalidRequestException('Invalid request: `redirect_uri` is not a valid URI');
    }

    if (redirectUri !== code.redirectUri) {
      throw new InvalidRequestException('Invalid request: `redirect_uri` is invalid');
    }
  }

  /**
   * Revokes the authorization code after it is used.
   * @param code Input payload representing the authorization code model.
   * @returns The revoked authorization code model.
   * @throws {InvalidGrantException}
   */
  async revokeAuthorizationCode(code: AuthorizationCode) {
    const status = await this.model.revokeAuthorizationCode(code);
    if (!status) {
      throw new InvalidGrantException('Invalid grant: authorization code is invalid');
    }
    return code;
  }

  /**
   * Persists access and refresh tokens associated with the code exchange.
   * @param user Input payload representing the resource owner.
   * @param client Input payload representing the OAuth client.
   * @param authorizationCode Authorization code string.
   * @param requestedScope Requested scope array.
   * @returns Saved OAuth token model.
   */
  async saveToken(
    user: OAuthUser,
    client: OAuthClient,
    authorizationCode: string,
    requestedScope?: string[],
  ): Promise<OAuthToken> {
    const validatedScope = await this.validateScope(user, client, requestedScope);
    const accessToken = await this.generateAccessToken(client, user, validatedScope);
    const refreshToken = await this.generateRefreshToken(client, user, validatedScope);
    const accessTokenExpiresAt = this.getAccessTokenExpiresAt();
    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

    const token: OAuthToken = {
      accessToken,
      authorizationCode,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
      scope: validatedScope,
      client,
      user,
    } as OAuthToken;

    return this.model.saveToken(token, client, user);
  }
}
