# Contributing to the OAuth Library

This document is for maintainers and contributors of the `libs/oauth` library. It describes how to run, test, and extend the library, and which coding and commit standards to follow.

---

## Table of Contents

- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Architecture and Conventions](#architecture-and-conventions)
- [Commit Messages](#commit-messages)
- [Adding New Grant Types or Guards](#adding-new-grant-types-or-guards)
- [Releasing / Consuming the Library](#releasing--consuming-the-library)

---

## Repository Layout

The OAuth library lives under the monorepo at `libs/oauth/`. The app that consumes it (and runs e2e tests) is `apps/umoja-api/`.

```
libs/oauth/
├── README.md                 # User-facing docs for implementing the lib in an app
├── CONTRIBUTING.md           # This file (maintainer guide)
├── tsconfig.lib.json         # TypeScript config for the lib
└── src/
    ├── index.ts              # Public API (re-exports)
    ├── config/               # Injection tokens (OAUTH2_SERVER_OPTIONS, AUTH_REPOSITORY)
    ├── decorators/           # @OAuthScopes, metadata key
    ├── exceptions/           # OAuth-specific HttpException subclasses
    ├── grant-types/          # Password, ClientCredentials, RefreshToken, AuthorizationCode
    ├── guards/               # OAuthGuard, OAuthOptionalGuard, OAuthScopeGuard, ApiKey, BasicAuth
    ├── handlers/             # Authenticate, Authorize, Token handlers
    ├── interfaces/           # AuthRepository, ServerOptions, OAuthToken, etc.
    ├── models/               # Token model helpers
    ├── response-types/       # Code, Token (authorization endpoint)
    ├── token-types/          # Bearer, MAC
    ├── utils/                # JWT, PKCE, scope, crypto, etc.
    ├── oauth.module.ts       # OauthModule (forRoot / forRootAsync)
    ├── oauth.service.ts      # OauthService (authenticate, authorize, token)
    ├── oauth.controller.ts   # Built-in /oauth/authorize and /oauth/token
    └── oauth.guard.ts        # Bearer auth guard (request.user / request.oauth)
```

Unit tests sit next to source files: `*.spec.ts`. E2E tests that exercise the library through the app live in `apps/umoja-api/test/*.e2e-spec.ts`.

---

## Prerequisites

- **Node.js** – Version from the repo root `.nvmrc` (or LTS).
- **npm** – Workspace root: `npm install` at repo root.
- **Nest CLI** – Available via `npx nest` from repo root (monorepo).

Path aliases used by the lib and the app:

- `@oauth/oauth` → `libs/oauth/src`
- `@oauth/oauth/*` → `libs/oauth/src/*`
- `@core/core` → `libs/core/src` (for `UmojaException` and shared core)

These are set in the root `tsconfig.json` and in Jest configs.

---

## Running the Project

The library is a **library** target; it is not run directly. You run the app that uses it.

From the **repository root**:

```bash
# Install dependencies (if not already)
npm install

# Build the oauth lib (optional; app build will compile it when needed)
npx nest build oauth

# Run the API app that consumes the lib
npm run start

# Or development with watch
npm run start:dev
```

The default app is `umoja-api`. It registers `OauthModule` and exposes demo routes and the token endpoint. See `apps/umoja-api/src/auth/` for the integration example.

---

## Testing

### Unit tests (lib only)

Unit tests live next to the source: `libs/oauth/src/**/*.spec.ts`. Jest is configured at the **repo root** with `moduleNameMapper` for `@oauth/oauth` and `@core/core`.

From the **repository root**:

```bash
# Run all unit tests (including other libs/apps)
npm test

# Run only oauth lib unit tests
npm test -- libs/oauth

# Watch mode
npm run test:watch -- libs/oauth

# Coverage (root Jest config may restrict to libs/oauth)
npm run test:cov
```

Coverage for the lib is configured in the root `package.json` under `jest.collectCoverageFrom` (e.g. `libs/oauth/src/**/*.ts` with ignores for specs, index, module). Run `npm run test:cov` and open the generated report.

### E2E tests (app + lib)

E2E tests boot the full app (with the OAuth lib integrated) and hit HTTP endpoints. They live in `apps/umoja-api/test/`.

From the **repository root**:

```bash
# Run all e2e tests
npm run test:e2e

# Run only auth-related e2e (guards, password, JWT, etc.)
npm run test:e2e -- auth-guards
npm run test:e2e -- auth-password
npm run test:e2e -- auth-jwt
npm run test:e2e -- auth-unauthorized
```

E2E config: `apps/umoja-api/test/jest-e2e.json`. It uses the same path aliases so that the app and tests resolve `@oauth/oauth` and `@core/core` correctly.

When you change the lib’s public API or behavior, run the relevant e2e specs (especially `auth-guards.e2e-spec.ts`, `auth-password.e2e-spec.ts`, `auth-jwt.e2e-spec.ts`) to avoid regressions.

---

## Code Standards

The repository follows the rules defined in the root **`.cursorrules`** and in this section. All code and comments in the lib are in **English**.

### Naming

- **No DTO/Request/Response** – Use **Input** for data entering a layer and **Output** for data leaving it. For the OAuth lib, “repository”, “options”, and “model” (for token/code shapes) are used (e.g. `ServerOptions`, `OAuthToken`, `AuthRepository`, `*Repository` interfaces in `model.interfaces.ts`).
- **Repository** – The injected auth storage is consistently named **authRepository** in constructors and properties. Interface names use the **Repository** suffix (e.g. `AuthorizationCodeRepository`, `PasswordRepository`).
- **Entities** – If the lib ever exposed DB-shaped objects, they would use the **Entity** suffix; currently the lib deals in interfaces and repository contracts only.
- **Files** – Prefer kebab-case: `oauth-scope.guard.ts`, `validators.interface.ts`, `oauth.tokens.ts`.

### JSDoc

- **Exported** classes, methods, and important properties must have a JSDoc block.
- **Methods:** Document `@param`, `@returns`, and `@throws` where relevant.
- **Properties:** Describe constraints (e.g. “Must be a valid UUID”, “Seconds since epoch”).
- Use “Input payload” and “Output model” where it helps clarify direction of data.

### Guards and dependency injection

- **ApiKeyGuard** and **BasicAuthGuard** inject **AUTH_REPOSITORY** and call **authRepository.validateApiKey** and **authRepository.validateBasicAuth** respectively. The consuming app must implement **AuthRepository** with these optional methods and provide **AUTH_REPOSITORY** (e.g. via **AuthModelModule**). No separate validator services or tokens.
- **OAuthGuard**, **OAuthOptionalGuard**, **OAuthScopeGuard** depend on **OauthService** (and **Reflector** for scope guard); they are registered and exported by **OauthModule**. **ApiKeyGuard** and **BasicAuthGuard** are also exported; they require **AUTH_REPOSITORY** to be available in the same module or imports.

### Environment and configuration

- **No raw `process.env`** in library code. Configuration is passed in via **OauthModule.forRoot** / **forRootAsync** (e.g. `token.jwt.secret`, lifetimes). Apps may use `ConfigService` or env in their own factories when calling `forRootAsync`.

### Exceptions

- All OAuth errors extend the project’s **UmojaException** (or Nest **HttpException**) and expose a stable **code** and **message** in the JSON body. When adding new error cases, use or extend the existing exception classes in `src/exceptions/` and keep **code** stable for API consumers.

### Anti-patterns to avoid

- **Circular dependencies** – Do not introduce `forwardRef()`; refactor into a shared module or split responsibilities.
- **God classes** – If a service or handler grows beyond ~300 lines or many dependencies, consider splitting (e.g. by grant type or handler responsibility).

---

## Architecture and Conventions

- **Handlers** – `AuthenticateHandler`, `AuthorizeHandler`, `TokenHandler` encapsulate HTTP-agnostic logic; they receive Fastify request/reply and use the injected **authRepository** (AUTH_REPOSITORY) and **OAUTH2_SERVER_OPTIONS**.
- **Grant types** – Each grant (password, client_credentials, refresh_token, authorization_code) is implemented in `grant-types/` and invoked by **TokenHandler** (and **AuthorizeHandler** for the code flow). Grant types extend **AbstractGrantType** and receive **authRepository** in options. New grant types should follow the same pattern and be registered in the module.
- **Token storage** – The library does not dictate storage. The app implements **AuthRepository** (getClient, getUser, saveToken, getAccessToken, getRefreshToken, revokeToken, and optionally validateApiKey, validateBasicAuth) and can use JWT for access tokens while storing refresh tokens opaquely.
- **JWT** – When `token.jwt` is configured, access tokens are signed JWTs; **AuthenticateHandler** verifies them using the same options (issuer, audience, secret/keys). Refresh tokens remain opaque unless the app implements a custom scheme.
- **Fastify** – The library is built for **Fastify** (request/reply). Do not add Express-specific code; keep adapters and types Fastify-based.

---

## Commit Messages

Follow **Conventional Commits** and the project’s commit rules (see root `.cursorrules`):

- **Format:** `<type>(<scope>): <subject>`
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scope:** Use when the change is limited to a component (e.g. `oauth`, `guards`, `oauth-module`).
- **Subject:** English, imperative, specific. No period at the end.
- **Body:** Required; English; explain what was done and why; wrap at 100 characters.
- **Line length:** Keep every line (subject and body) ≤ 100 characters.

Examples:

```
feat(oauth): add ApiKeyGuard and BasicAuthGuard with validator interfaces

Introduces optional guards for x-api-key and Basic auth. Apps provide
OAUTH_API_KEY_VALIDATOR and OAUTH_BASIC_AUTH_VALIDATOR to use them.
```

```
fix(oauth): ensure OAuthScopeGuard reads scopes from class and handler metadata

getAllAndOverride was only checking handler; now checks both handler and
class so controller-level @OAuthScopes applies to all methods when intended.
```

---

## Adding New Grant Types or Guards

### New grant type

1. Add the grant class under `src/grant-types/` (e.g. `custom-grant-type.ts`) following the pattern of `PasswordGrantType` / `ClientCredentialsGrantType`: validate request, call repository, generate tokens, return token payload.
2. Register the grant in **TokenHandler** (and in **OauthModule** providers if it is a separate injectable).
3. Extend **AuthRepository** (or document which methods the new grant needs) in `interfaces/model.interfaces.ts` (repository interfaces: `*Repository`) and in **README.md**.
4. Add unit tests next to the new grant and, if applicable, e2e tests in `apps/umoja-api/test/`.

### New guard

1. Add the guard under `src/guards/` (e.g. `custom.guard.ts`). Prefer injecting **AUTH_REPOSITORY** and calling optional methods (e.g. **validateApiKey**) so the repository remains the single data conduit; only add a separate validator token/interface if the guard cannot use the auth repository.
2. Export the guard (and token/interface if any) from `src/guards/index.ts`. Add it to **OauthModule** providers/exports if it only depends on **AUTH_REPOSITORY** (like **ApiKeyGuard**, **BasicAuthGuard**). Otherwise, document in **README** that the app must register the guard and its dependencies.
3. Add unit tests (`guards/custom.guard.spec.ts`) and, if relevant, e2e coverage in `apps/umoja-api/test/auth-guards.e2e-spec.ts`.

---

## Releasing / Consuming the Library

The library is consumed inside the monorepo via the `@oauth/oauth` path. There is no separate npm publish step for the OAuth lib in the default setup.

- **Build:** From repo root, `npx nest build oauth` (or build the app that depends on it, e.g. `npx nest build umoja-api`).
- **Versioning:** If the monorepo uses a single version (e.g. root `package.json`), changes to the OAuth lib follow that version. If you introduce a separate version for the lib, document it in the root and in this file.
- **Changelog:** For notable changes (new guards, new options, breaking changes to **AuthRepository** or **ServerOptions**), update **README.md** and, if the project keeps a CHANGELOG, add an entry there.

When you change the **public API** (exports in `index.ts`, **OauthModule** options, **AuthRepository** contract, exception codes, or guard dependencies), update:

1. **README.md** – So implementers know how to use or migrate.
2. **CONTRIBUTING.md** – If new conventions or test commands were added.
3. **apps/umoja-api** – So the reference app and e2e tests stay in sync with the lib.
