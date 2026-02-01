# Umoja Gateway

High-performance BFF (Backend for Frontend) built with [NestJS](https://nestjs.com) and [Fastify](https://www.fastify.io). Provides OAuth2 token issuance, Bearer and optional API key / Basic auth, and route guards for protected APIs.

---

## Description

- **apps/umoja-api** – NestJS API app (BFF) that consumes the OAuth library and exposes demo auth routes and token endpoint.
- **libs/core** – Shared core module, service, and base exception (`UmojaException`) for the gateway.
- **libs/oauth** – OAuth2 library: password, client_credentials, refresh_token, authorization_code grants; Bearer authentication; guards (OAuthGuard, OAuthScopeGuard, OAuthOptionalGuard, ApiKeyGuard, BasicAuthGuard). See [libs/oauth/README.md](libs/oauth/README.md) for full documentation.

All OAuth errors extend Nest `HttpException` with stable `code` and `message` for API consumers.

---

## Project setup

```bash
npm install
```

---

## Compile and run

```bash
# development
npm run start

# watch mode
npm run start:dev

# production
npm run start:prod
```

Default app is **umoja-api**; it listens on the port from `process.env.port` or `3000`.

---

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# coverage
npm run test:cov
```

Unit tests live next to source (`*.spec.ts`). E2E tests for auth and guards are in `apps/umoja-api/test/` (e.g. `auth-guards.e2e-spec.ts`, `auth-password.e2e-spec.ts`).

---

## Documentation

- **[libs/oauth/README.md](libs/oauth/README.md)** – OAuth library: installation, module registration, auth repository, guards, decorators, configuration, and full app integration example.
- **[libs/oauth/CONTRIBUTING.md](libs/oauth/CONTRIBUTING.md)** – Contributing guide for the OAuth library (layout, testing, code standards, commit messages).
- **[apps/umoja-api/docs/oauth-entities.puml](apps/umoja-api/docs/oauth-entities.puml)** – PlantUML entity model for the OAuth repository (includes Product → Clients). Render with `plantuml -tpng apps/umoja-api/docs/oauth-entities.puml`.
- **[apps/umoja-control-plane/docs/oauth-strapi-model.puml](apps/umoja-control-plane/docs/oauth-strapi-model.puml)** – PlantUML content model for Strapi (includes oauth-product and its 1:N clients). Render with `plantuml -tpng apps/umoja-control-plane/docs/oauth-strapi-model.puml`.

---

## License

[MIT](LICENSE).
