# Postman – Umoja OAuth API

Collection and environment to test OAuth and auth-demo endpoints against the Umoja API.

## Setup

1. **Seed Strapi (control-plane)**  
   From repo root or `apps/umoja-control-plane`:
   ```bash
   npm run seed:oauth
   ```
   Or: `cd apps/umoja-control-plane && npm run seed:oauth`

2. **Start Umoja API**  
   From repo root:
   ```bash
   npm run start:dev
   ```
   API runs at `http://localhost:3000` by default.

3. **Token/authorize endpoints**  
   To use **OAuth Token** and **OAuth Authorize** in Postman, the app must expose them. In `apps/umoja-api/src/auth/auth.module.ts`, set `includeControllers: true` in `OauthModule.forRootAsync` (default in this app is `false`).

## Import in Postman

- **Collection:** `Umoja-OAuth-API.postman_collection.json`
- **Environment:** `Umoja-OAuth-Local.postman_environment.json`

1. Open Postman → Import → upload both files.
2. Select the **Umoja OAuth - Local** environment in the top-right dropdown.
3. Run requests; token requests will store `access_token` and `refresh_token` in the environment.

## Environment variables (seed-based)

| Variable        | Seed value              | Description |
|----------------|-------------------------|-------------|
| `base_url`     | `http://localhost:3000` | Umoja API base URL |
| `api_key`      | `umoja-api-key-demo`    | x-api-key for auth-demo admin/clients/users |
| `client_id`    | (from seed output)      | OAuth client id: **Strapi v5 uses documentId** (e.g. `clxxx...`). Run `npm run seed:oauth` in control-plane and use the printed `client_id`. |
| `client_secret`| `umoja-demo-secret`     | OAuth client secret |
| `username`     | `demo-user`             | User for password grant and Basic auth |
| `password`     | `demo-pass`             | User password |
| `access_token` | (set by collection)     | Filled by Token - Client Credentials / Password / Refresh / Authorization Code |
| `refresh_token`| (set by collection)     | Filled by Token - Password / Refresh / Authorization Code |
| `redirect_uri` | `http://localhost:3000/callback` | Redirect URI for authorization_code flow; must be in client `redirectUris`. |
| `state`       | `postman-state`         | State parameter for authorize request (required by server). |
| `authorization_code` | (set by collection) | Filled by **Authorize (get code)**; used by Token - Authorization Code. |

If after running `seed:oauth` the console shows a different **client id**, set `client_id` in the environment to that value. For **OAuth Authorization Code**, the client must have grant `authorization_code` and `redirectUris` including `redirect_uri` (e.g. http://localhost:3000/callback).

## Folders

- **Auth (API Key)** – Create client/user, Admin (x-api-key), Session (Basic auth).
- **OAuth Token** – Client credentials, Password, Refresh; scripts save tokens to the environment.
- **OAuth Authorization Code** – Authorize (get code) with Basic auth → 302; Token - Authorization Code exchanges code for tokens. Run Authorize first; disable "Automatically follow redirects" on Authorize so the Test script can read the 302 Location and save the code.
- **Protected (Bearer)** – Profile, Profile Write (scope), Me (optional auth).
- **Root** – Health/root GET.
- **Test Scenarios (Negative)** – Requests that expect 400/401; used to validate auth enforcement.

---

## Test scenarios specification

Each request includes **Tests** scripts that run after the response. Run the collection (e.g. Collection Runner) to validate all scenarios.

### Positive scenarios (success)

| # | Scenario | Request | Expected status | Assertions |
|---|----------|---------|-----------------|------------|
| 1 | Create client with valid x-api-key | POST /auth-demo/clients | 201 | Body has `clientId`, `clientSecret`, `grants` (array). |
| 2 | Create user with valid x-api-key | POST /auth-demo/users | 201 | Body has `user` with `username`. |
| 3 | Admin with valid x-api-key | GET /auth-demo/admin | 200 | Body has `message` (contains "API key") and `role` = "admin". |
| 4 | Session with valid Basic auth | GET /auth-demo/session | 200 | Body has `user` and `message` (contains "Basic"). |
| 5 | Token – client_credentials (valid client) | POST /oauth/token | 200 | Body has `access_token` (string) and `token_type` = "Bearer". |
| 6 | Token – password (valid user + client) | POST /oauth/token | 200 | Body has `access_token`, `refresh_token`, `token_type` = "Bearer". |
| 7 | Token – refresh_token (valid refresh) | POST /oauth/token | 200 | Body has `access_token` and `token_type` = "Bearer". |
| 8 | Authorize – get code (Basic auth) | GET /oauth/authorize?response_type=code&client_id&redirect_uri&state | 302 | Location header has `code=` and `state=`; Test script saves code to `authorization_code`. |
| 9 | Token – authorization_code (exchange code) | POST /oauth/token | 200 | Body has `access_token`, `refresh_token`, `token_type` = "Bearer". Run Authorize first. |
| 10 | Profile with valid Bearer | GET /auth-demo/profile | 200 | Body has `user` and `scopes`. |
| 11 | Profile Write with valid Bearer (scope write) | GET /auth-demo/profile/write | 200 or 403 | If 200: body has `message` containing "write". If 403: token lacks scope. |
| 12 | Me with valid Bearer | GET /auth-demo/me | 200 | Body has `authenticated`, `user`, `scopes`. |
| 13 | Root (no auth) | GET / | 200 | — |

### Negative scenarios (unauthorized / invalid)

| # | Scenario | Request | Expected status | Assertions |
|---|----------|---------|-----------------|------------|
| N1 | Admin without x-api-key | GET /auth-demo/admin (no header) | 401 | — |
| N2 | Create client without x-api-key | POST /auth-demo/clients (no x-api-key) | 401 | — |
| N3 | Profile without Authorization | GET /auth-demo/profile (no header) | 401 | — |
| N4 | Profile with invalid Bearer | GET /auth-demo/profile, Authorization: Bearer invalid-token | 401 | — |
| N5 | Token with wrong client_secret | POST /oauth/token (client_credentials, wrong secret) | 400 or 401 | — |
| N6 | Token with wrong password | POST /oauth/token (password, wrong password) | 400 or 401 | — |
| N7 | Token with invalid refresh_token | POST /oauth/token (refresh_token, invalid token) | 400 or 401 | If 400: body has `error` = invalid_grant. |
| N8 | Token with invalid authorization code | POST /oauth/token (authorization_code, invalid code) | 400 or 401 | If 400: body has `error` = invalid_grant. |

### Running all tests

1. Import the collection and environment; select **Umoja OAuth - Local**.
2. Run **Token - Password** once so `access_token` and `refresh_token` are set (required for Protected and for Token - Refresh).
3. For **OAuth Authorization Code**: run **Authorize (get code)** first (disable "Automatically follow redirects" on that request so the Test script can save the code), then **Token - Authorization Code**.
4. Use **Collection Runner**: select the collection, run all requests. Run **OAuth Token** in order: Token - Password, then Token - Refresh. Run **OAuth Authorization Code** in order: Authorize (get code), then Token - Authorization Code. All positive requests should pass (green); negative token requests expect 400 or 401 and pass the status test.
