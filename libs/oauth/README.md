# OAuth Nest Library

NestJS-friendly TypeScript OAuth2 library for token issuance (password, client_credentials, refresh_token, authorization_code), Bearer authentication, and route guards. Uses Fastify request/response. All errors extend NestJS `HttpException` with stable `code` and `message` for API consumers.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Module Registration](#module-registration)
- [Auth Repository](#auth-repository)
- [OAuth Controller](#oauth-controller)
- [OAuth Service](#oauth-service)
- [Guards](#guards)
- [Decorators](#decorators)
- [Optional Guards (API Key & Basic Auth)](#optional-guards-api-key--basic-auth)
- [Configuration Options](#configuration-options)
- [Grant Types](#grant-types)
- [Error Handling](#error-handling)
- [Request Shape After Auth](#request-shape-after-auth)
- [Example: Full App Integration](#example-full-app-integration)

---

## Installation

The library lives in the monorepo under `libs/oauth`. In your app, use the path alias `@oauth/oauth` (or `@oauth/oauth/*`). Ensure the workspace has:

- `@nestjs/common`, `@nestjs/core`
- `fastify` and `@nestjs/platform-fastify` (the library is built for Fastify)
- Peer/transitive dependencies used by the lib (e.g. for JWT, crypto)

No separate npm publish is required when using the monorepo path.

---

## Quick Start

1. Implement the **AuthRepository** interface (your storage for clients, users, tokens). Optionally implement **validateApiKey** and **validateBasicAuth** so the repository is the single data conduit for API key and Basic auth.
2. Register **OauthModule.forRoot()** or **OauthModule.forRootAsync()** with `model` (your auth repository) and optional `token`/JWT config.
3. Use **OAuthGuard** on protected routes; read `request.user` and `request.oauth` in handlers.
4. Optionally use **OAuthScopeGuard** + **@OAuthScopes()** for scope-based access, or **ApiKeyGuard** / **BasicAuthGuard** (they use **AUTH_REPOSITORY** directly when the repository implements **validateApiKey** and **validateBasicAuth**).

Minimal example:

```ts
// app.module.ts or auth.module.ts
import { Module } from '@nestjs/common';
import { OauthModule } from '@oauth/oauth';
import { MyAuthRepository } from './my-auth.repository';
import { AUTH_REPOSITORY } from '@oauth/oauth';

@Module({
  imports: [
    OauthModule.forRootAsync({
      imports: [MyAuthModelModule],
      useFactory: (repo: AuthRepository) => ({
        model: repo,
        includeControllers: true,
        token: {
          accessTokenLifetime: 30 * 60,
          refreshTokenLifetime: 7 * 24 * 60 * 60,
          alwaysIssueNewRefreshToken: true,
          jwt: {
            issuer: 'my-api',
            audience: 'my-clients',
            secret: 'your-secret',
            algorithm: 'HS256',
            keyId: 'my-key',
          },
        },
      }),
      inject: [AUTH_REPOSITORY],
    }),
  ],
})
export class AuthModule {}
```

Then in a controller:

```ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { OAuthGuard } from '@oauth/oauth';
import type { FastifyRequest } from 'fastify';

@Controller('api')
export class ApiController {
  @Get('profile')
  @UseGuards(OAuthGuard)
  profile(@Req() req: FastifyRequest) {
    return { user: (req as any).user, scopes: (req as any).oauth?.scopes };
  }
}
```

---

## Module Registration

### `OauthModule.forRoot(options)`

Use when you have the config synchronously.

| Option | Type | Description |
|--------|------|-------------|
| `model` | `AuthRepository` | Implementation of the OAuth model (clients, users, tokens). |
| `includeControllers` | `boolean` | If `true` (default), registers the built-in **OauthController** (`/oauth/authorize`, `/oauth/token`). |
| `scope` | `string \| string[]` | Optional default scope required when authenticating Bearer tokens. |
| `accessTokenLifetime` | `number` | Access token TTL in seconds. |
| `refreshTokenLifetime` | `number` | Refresh token TTL in seconds. |
| `alwaysIssueNewRefreshToken` | `boolean` | Whether to issue a new refresh token on every refresh. |
| `jwt` | `JwtTokenOptions` | JWT signing/verification (issuer, audience, secret/keys, algorithm, keyId). |
| … | See [Configuration Options](#configuration-options) | Other auth/authorize/token options. |

### `OauthModule.forRootAsync(options)`

Use when the model or config comes from DI (e.g. database-backed repository).

| Option | Type | Description |
|--------|------|-------------|
| `imports` | `Module[]` | Modules that export the injected dependencies. |
| `useFactory` | `(…deps) => OauthModuleOptions \| Promise<OauthModuleOptions>` | Factory that returns the same options as `forRoot`. |
| `inject` | `any[]` | Injection tokens for the factory arguments (e.g. `[AUTH_REPOSITORY]`). |
| `includeControllers` | `boolean` | Same as in `forRoot`. |

The module exports: **OauthService**, **OAuthGuard**, **OAuthOptionalGuard**, **OAuthScopeGuard**, **ApiKeyGuard**, and **BasicAuthGuard**. **ApiKeyGuard** and **BasicAuthGuard** inject **AUTH_REPOSITORY**; you must provide **AUTH_REPOSITORY** (e.g. via **AuthModelModule**) and implement **validateApiKey** and **validateBasicAuth** on your repository (see [Optional Guards](#optional-guards-api-key--basic-auth)).

---

## Auth Repository

You must implement **AuthRepository**, which composes the contracts for the grant types you use. The library uses the token **AUTH_REPOSITORY** for DI; register your implementation with that token. All handlers and guards that need storage inject **authRepository** (same token).

### Required for all flows

- **getClient(clientId, clientSecret)** – Return client or falsy.
- **saveToken(token, client, user)** – Persist token; return the saved token.
- **getAccessToken(accessToken)** – Return stored token or falsy (used for Bearer validation when not using JWT).

### Password grant

- **getUser(username, password, client)** – Return user or falsy.
- **validateScope?** – Optional; validate requested scope for the user/client.
- **generateAccessToken?**, **generateRefreshToken?** – Optional; if not provided, the library can generate opaque tokens or use JWT.

### Client credentials grant

- **getUserFromClient(client)** – Return the user associated with the client (or null).
- **validateScope?** – Optional.

### Refresh token grant

- **getRefreshToken(refreshToken)** – Return refresh token record or falsy.
- **revokeToken(refreshToken)** – Revoke the refresh token; return boolean.
- **generateRefreshToken?** – Optional.

### Authorization code grant

- **getAuthorizationCode(authorizationCode)** – Return code record or falsy.
- **saveAuthorizationCode(code, client, user)** – Persist the code.
- **revokeAuthorizationCode(code)** – Revoke after use.
- **validateRedirectUri?(redirectUri, client)** – Optional.
- **validateScope?** – Optional.
- **generateAuthorizationCode?** – Optional.

### Optional (Bearer / JWT)

- **verifyScope?(token, scope)** – Used when you set `scope` in server options to require scopes on authenticated requests.
- **getAudiences?(client, user, scope)** – For JWT; return allowed audience(s) so the library can validate the token’s `aud` claim.

### Optional (API key and Basic auth – repository as single data conduit)

- **validateApiKey?(apiKey)** – When implemented, **ApiKeyGuard** uses it to validate the `x-api-key` header. No separate validator service; the repository is the single source of truth.
- **validateBasicAuth?(username, password)** – When implemented, **BasicAuthGuard** uses it to validate `Authorization: Basic` and attach the user to the request. No separate validator service.

Register the repository in a module that you then import into the module that calls `OauthModule.forRootAsync`:

```ts
import { Module } from '@nestjs/common';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { MyAuthRepository } from './my-auth.repository';

@Module({
  providers: [{ provide: AUTH_REPOSITORY, useClass: MyAuthRepository }],
  exports: [AUTH_REPOSITORY],
})
export class AuthModelModule {}
```

---

## OAuth Controller

When `includeControllers: true`, the library registers **OauthController** with:

| Method | Path | Description |
|--------|------|-------------|
| `ALL` | `/oauth/authorize` | Authorization code flow (redirects, code issuance). |
| `POST` | `/oauth/token` | Token endpoint: password, client_credentials, refresh_token, authorization_code. |

The controller uses the app’s Fastify adapter. Request/response are passed through to **OauthService.authorize** and **OauthService.token**. You can omit the controller by setting `includeControllers: false` and expose your own routes that call the service.

---

## OAuth Service

Inject **OauthService** where you need to drive OAuth flows programmatically.

| Method | Description |
|--------|-------------|
| **authenticate(request, reply)** | Validates the Bearer token (header or body/query if allowed). Returns the OAuth token model; throws on missing/invalid token or insufficient scope (if `scope` is configured). Used internally by **OAuthGuard**. |
| **authorize(request, reply)** | Handles the authorization code request (redirect, code issuance). |
| **token(request, reply)** | Handles the token request (all supported grant types). |

All methods use the Fastify `request` and `reply` objects. Errors are thrown as Nest `HttpException` subclasses (see [Error Handling](#error-handling)).

---

## Guards

Guards protect routes and attach context to the request. They are exported by **OauthModule** when you use `forRoot`/`forRootAsync`.

### OAuthGuard

- **Role:** Requires a valid Bearer token. Validates the token and attaches **user** and **oauth** to the request.
- **Use when:** The route must be authenticated; no token or invalid token → 401.
- **Request after guard:** `request.user` (resource owner), `request.oauth.token`, `request.oauth.scopes`.

```ts
@Get('profile')
@UseGuards(OAuthGuard)
profile(@Req() req: FastifyRequest) {
  return { user: (req as any).user, scopes: (req as any).oauth?.scopes };
}
```

### OAuthOptionalGuard

- **Role:** Tries to authenticate; if a valid Bearer is present, attaches **user** and **oauth**; otherwise the request continues with no user/oauth (no error).
- **Use when:** The route works for both anonymous and authenticated users (e.g. public feed with extra data when logged in).

```ts
@Get('me')
@UseGuards(OAuthOptionalGuard)
me(@Req() req: FastifyRequest) {
  const user = (req as any).user ?? null;
  return { user, authenticated: user != null };
}
```

### OAuthScopeGuard

- **Role:** Ensures the request has an OAuth context and that the token’s scopes include all scopes required by the route (set via **@OAuthScopes()**). Must be used **after** **OAuthGuard** so that `request.oauth` exists.
- **Use when:** The route requires specific scopes (e.g. `write`, `admin`). If no scopes are set on the handler/class, the guard allows access.

```ts
@Get('admin')
@UseGuards(OAuthGuard, OAuthScopeGuard)
@OAuthScopes('admin', 'write')
adminOnly(@Req() req: FastifyRequest) {
  return { user: (req as any).user };
}
```

---

## Decorators

### @OAuthScopes(...scopes)

Sets the list of scopes required for the route. **OAuthScopeGuard** reads this via the metadata key `OAUTH_SCOPES_KEY`. You can export the constant from `@oauth/oauth` if you need it for custom logic.

- **Usage:** On controller methods (or class); use together with **OAuthGuard** + **OAuthScopeGuard**.
- **Example:** `@OAuthScopes('read', 'write')`

---

## Optional Guards (API Key & Basic Auth)

**ApiKeyGuard** and **BasicAuthGuard** inject **AUTH_REPOSITORY** and use it as the single data conduit. No separate validator services or tokens; implement **validateApiKey** and **validateBasicAuth** on your **AuthRepository**.

### ApiKeyGuard

- **Role:** Validates the `x-api-key` header by calling **authRepository.validateApiKey(apiKey)**. Throws when the method is missing or returns false.
- **Provider:** Ensure **AUTH_REPOSITORY** is provided (e.g. by **AuthModelModule**) and that your repository implements **validateApiKey(apiKey: string | undefined): boolean**.

```ts
// my-auth.repository.ts – implement validateApiKey
validateApiKey(apiKey: string | undefined): boolean {
  return apiKey === this.expectedApiKey; // e.g. from ConfigService or AUTH_EXPECTED_API_KEY
}

// auth.module.ts – repository is already provided; just add the guard
@Module({
  imports: [AuthModelModule, OauthModule.forRootAsync({ ... })],
  providers: [ApiKeyGuard, BasicAuthGuard, ...],
})
export class AuthModule {}
```

Use on routes:

```ts
@Get('admin')
@UseGuards(ApiKeyGuard)
admin() {
  return { message: 'API key valid' };
}
```

### BasicAuthGuard

- **Role:** Parses `Authorization: Basic <base64(user:password)>`, calls **authRepository.validateBasicAuth(username, password)**, and attaches **user** to the request when valid.
- **Provider:** Ensure **AUTH_REPOSITORY** is provided and that your repository implements **validateBasicAuth(username, password): Promise<BasicAuthValidationResult | null>**.

```ts
// my-auth.repository.ts – implement validateBasicAuth
async validateBasicAuth(username: string, password: string): Promise<BasicAuthValidationResult | null> {
  const client = await this.getClient('your-basic-auth-client-id', null);
  if (!client) return null;
  const user = await this.getUser(username, password, client);
  return user ? { user } : null;
}
```

Use on routes:

```ts
@Get('session')
@UseGuards(BasicAuthGuard)
session(@Req() req: FastifyRequest) {
  return { user: (req as any).user };
}
```

---

## Configuration Options

Relevant options you can pass to **forRoot** / **forRootAsync** (under **ServerOptions**):

| Option | Type | Description |
|--------|------|-------------|
| **Authentication** | | |
| `scope` | `string \| string[]` | Required scope(s) when validating Bearer tokens (AuthenticateHandler). |
| `addAcceptedScopesHeader` | `boolean` | Send `X-Accepted-OAuth-Scopes` on auth responses. |
| `addAuthorizedScopesHeader` | `boolean` | Send `X-OAuth-Scopes` on auth responses. |
| `allowBearerTokensInQueryString` | `boolean` | Allow `access_token` in query (not recommended in production). |
| **Token issuance** | | |
| `accessTokenLifetime` | `number` | Access token TTL (seconds). |
| `refreshTokenLifetime` | `number` | Refresh token TTL (seconds). |
| `alwaysIssueNewRefreshToken` | `boolean` | Issue new refresh token on every refresh. |
| `jwt` | `JwtTokenOptions` | `issuer`, `audience`, `secret` or `privateKey`/`publicKey`, `algorithm`, `keyId`, `clockToleranceSeconds`. |
| **Authorization code** | | |
| `authorizationCodeLifetime` | `number` | Code TTL (seconds). |
| `allowEmptyState` | `boolean` | Allow missing `state` in authorize request. |

Nested **token** object can override token-related options.

---

## Grant Types

Supported out of the box:

- **password** – `grant_type=password` with `username`, `password`, `client_id`, `client_secret`, optional `scope`.
- **client_credentials** – `grant_type=client_credentials` with `client_id`, `client_secret`, optional `scope`.
- **refresh_token** – `grant_type=refresh_token` with `refresh_token`, `client_id`, `client_secret`, optional `scope`.
- **authorization_code** – `grant_type=authorization_code` with `code`, `redirect_uri`, `client_id`, `client_secret`, optional `code_verifier` (PKCE).

Token endpoint expects `application/x-www-form-urlencoded` body. Responses follow the OAuth2 token response format (e.g. `access_token`, `refresh_token`, `token_type`, `expires_in`, `scope`). With JWT configured, access tokens are signed JWTs; the library validates them using the same options (issuer, audience, secret/keys).

---

## Error Handling

All library errors extend **UmojaException** (or Nest **HttpException**) and return a JSON body with at least:

- **message:** Human-readable message.
- **code:** Stable machine-readable code (e.g. `UNAUTHORIZED_REQUEST`, `INVALID_REQUEST`, `INVALID_TOKEN`, `INSUFFICIENT_SCOPE`, `INVALID_GRANT`, `INVALID_CLIENT`).

HTTP status codes: 400 (invalid request, bad token format), 401 (unauthorized, invalid/missing token or credentials), 403 (insufficient scope). You can rely on Nest’s default exception filter or implement a custom one that maps these codes to your API contract.

---

## Request Shape After Auth

After **OAuthGuard** or **OAuthOptionalGuard** (when token is valid):

- **request.user** – Resource owner (e.g. `{ id, username, scope }` from your model).
- **request.oauth** – `{ token: OAuthToken, scopes: string[] }` (scopes = `token.scope`).

After **BasicAuthGuard**:

- **request.user** – The object returned by **authRepository.validateBasicAuth** in **BasicAuthValidationResult.user**.

---

## Example: Full App Integration

Reference implementation: **apps/umoja-api** in the same monorepo.

1. **AuthModelModule** – Provides **AUTH_REPOSITORY** (e.g. **InMemoryAuthRepository** with **validateApiKey** and **validateBasicAuth**). Optionally provides **AUTH_EXPECTED_API_KEY** for the repository’s API key check.
2. **AuthModule** – Imports **AuthModelModule**, registers **OauthModule.forRootAsync** with `model` (auth repository), `includeControllers: false`, and JWT in `token`; registers **ApiKeyGuard** and **BasicAuthGuard** (they use **AUTH_REPOSITORY** directly; no separate validator services).
3. **AuthExampleController** – Demonstrates:
   - **OAuthGuard** on `GET /auth-demo/profile`
   - **OAuthGuard** + **OAuthScopeGuard** + **@OAuthScopes('write')** on `GET /auth-demo/profile/write`
   - **OAuthOptionalGuard** on `GET /auth-demo/me`
   - **ApiKeyGuard** on `GET /auth-demo/admin`
   - **BasicAuthGuard** on `GET /auth-demo/session`
4. Token endpoint is mounted separately (e.g. **OauthController** at `/oauth/token` in another module with `includeControllers: true`, or a custom controller that calls **OauthService.token**).

For full request/response shapes and error cases, see the e2e tests under **apps/umoja-api/test/auth-guards.e2e-spec.ts** and other auth e2e specs.
