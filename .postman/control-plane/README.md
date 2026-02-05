# Postman – Umoja Control Plane

Collection and environment to test the Strapi-based control plane API locally (OAuth clients, users, API keys, content types).

## Setup

1. **Start the control plane** (from repo root or `apps/umoja-control-plane`):
   ```bash
   npm run develop
   ```
   API runs at `http://localhost:1337` by default.

2. **Seed OAuth data** (optional, for demo clients/users):
   ```bash
   npm run seed:oauth
   ```
   Use the printed `client_id` (documentId) in the **Umoja API** Postman environment when testing the gateway.

3. **Optional – API Token**  
   For endpoints that require authentication: Strapi Admin → Settings → API Tokens → Create token. Set the token value in the environment variable `api_token`. The collection uses Bearer auth; when `api_token` is set, it is sent on all requests (except those that explicitly use no auth).

## Import in Postman

- **Collection:** `Umoja-Control-Plane.postman_collection.json`
- **Environment:** `Umoja-Control-Plane-Local.postman_environment.json`

1. Open Postman → Import → upload both files.
2. Select the **Umoja Control Plane - Local** environment.
3. Run requests; test scripts assert status and response shape.

## Environment variables

| Variable     | Example                 | Description |
|-------------|-------------------------|-------------|
| `base_url`  | `http://localhost:1337` | Control plane base URL. |
| `api_token` | (from Strapi Admin)      | Optional. Bearer token for protected endpoints. |

## Folders

- **Health & Admin** – Server root (GET /).
- **OAuth (Control Plane)** – List oauth-clients, oauth-users, oauth-products, oauth-audiences, api-keys.
- **Content types** – About (single), articles, authors, categories, global (single).
- **Test Scenarios (Negative)** – No auth / invalid documentId; expect 403 or 404.

## Test scripts

Each request includes **Tests** that run after the response:

- **200** – Assert `data` array (list) or `data` object (single type).
- **403** – Allowed when permissions require an API token and none is set.
- **404** – Invalid documentId.

Use **Collection Runner** to run all requests and validate behaviour.
