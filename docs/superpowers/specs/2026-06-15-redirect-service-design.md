# redirect-service — Design

**Date:** 2026-06-15
**Status:** Approved

## Purpose

A self-contained redirect service with a simple admin UI. Operators log in
(GitHub OAuth, or a dev login locally) and configure HTTP redirects for domains
they control. When a domain's CNAME is pointed at this service, it automatically
obtains and renews a valid Let's Encrypt TLS certificate and serves the
configured redirects over HTTPS. Ships as a single Docker image built in CI.

## Requirements

- Configure **permanent (301)** and **temporary (302)** redirects.
- Two rule kinds:
  - **Whole-domain redirect**: `old.com/*` → `new.com`, path/query preserved by
    default with a per-rule toggle to drop it.
  - **Exact link redirect**: `old.com/promo` → `shop.com/sale` (exact path match).
- Automatic, valid SSL certificates for any configured domain once its CNAME
  resolves to the service (ACME / Let's Encrypt, on-demand).
- Admin UI gated by GitHub OAuth (org membership) plus a single dev/admin login
  for local development.
- Runs in a single Docker container, image built and pushed by the GitHub
  Actions pipeline.

## Architecture

Single container, two processes supervised by **s6-overlay**:

```
                 :80 / :443
                     │
                 ┌───▼─────────────────────┐
   Internet ───► │  Caddy                  │  terminates TLS
                 │  • ACME on-demand TLS    │  obtains LE certs on first hit
                 │  • ask → /internal/...   │  for an *allowed* domain
                 └───┬─────────────────────┘  reverse-proxies all requests
                     │ 127.0.0.1:3000
                 ┌───▼─────────────────────┐
                 │  Node / Express          │
                 │  • redirect resolver     │
                 │  • admin UI (htmx)       │
                 │  • OAuth + dev login     │
                 │  • /internal/tls-allowed │
                 └───┬─────────────────────┘
                     │
              ┌──────▼───────┐
              │ /data volume │  SQLite (rules) + Caddy cert cache
              └──────────────┘
```

- **Caddy** owns ports 80/443, terminates TLS, and handles all ACME. Its
  `on_demand_tls` feature calls `GET http://127.0.0.1:3000/internal/tls-allowed?domain=X`
  before issuing a cert; Caddy issues only when Node answers `200`. This gates
  cert issuance to registered domains (plus the admin host) and prevents
  ACME flooding. Caddy reverse-proxies every request to Node.
- **Node/Express** does redirect resolution, the admin UI/API, auth, and the
  internal allowlist endpoint. Listens on `127.0.0.1:3000` only.
- **/data volume** holds the SQLite database and Caddy's certificate cache, so
  both survive container restarts. Backup = copy the volume.

## Data model (SQLite via `better-sqlite3`)

**domains**
| column | type | notes |
|---|---|---|
| id | integer pk | |
| hostname | text unique | lowercased FQDN |
| mode | text | `'domain'` or `'links'` |
| target_url | text null | required when mode = `domain` |
| preserve_path | integer (bool) | domain mode; default 1 |
| redirect_type | integer | 301 or 302; domain mode |
| created_at | text | ISO timestamp |

**link_redirects**
| column | type | notes |
|---|---|---|
| id | integer pk | |
| domain_id | integer fk → domains.id | cascade delete |
| source_path | text | exact path, e.g. `/promo` |
| target_url | text | absolute URL |
| redirect_type | integer | 301 or 302 |
| created_at | text | |

Unique constraint on (`domain_id`, `source_path`).

## Redirect resolver (pure, unit-tested core)

`resolve(host, path, query, domainRecord) → { status, location } | { status: 404 }`

1. Look up domain by `host` (lowercased, port stripped). None → `404`.
2. `mode === 'domain'`:
   `location = target_url + (preserve_path ? path + query : '')`,
   status = the domain's `redirect_type`.
3. `mode === 'links'`: exact match on `source_path` → that rule's `target_url`
   and `redirect_type`; otherwise → `404`.

The resolver is a pure function over already-loaded records so it can be tested
exhaustively without a DB or network.

## Auth

Gates only `/admin` and the CRUD API. Redirect traffic and `/internal/*` are not
gated (`/internal/tls-allowed` is bound to localhost / only reachable from Caddy).

- **GitHub OAuth**: login → callback → verify the user is a member of
  `ALLOWED_GITHUB_ORG` via the GitHub API → store the user in a signed-cookie
  session. Non-members are rejected.
- **Dev login**: when `DEV_ADMIN_USER` and `DEV_ADMIN_PASSWORD` are set, a simple
  login form accepts those credentials (local development without GitHub).
  Unset in production ⇒ the dev login route is disabled.
- The admin UI is served only when the request `Host` equals `ADMIN_HOSTNAME`;
  any other Host is treated as redirect traffic.

## Admin UI (server-rendered HTML + htmx)

- Domain list with add-domain form (hostname + mode).
- Per-domain edit:
  - domain mode: target URL, path-preserve toggle, 301/302 selector;
  - links mode: CRUD table of `source_path` → `target_url` (301/302) rules.
- Each domain row shows a **CNAME status check** (live DNS lookup compared
  against `CNAME_TARGET`) and a **certificate-present** indicator.
- Validation: target URLs must be absolute and well-formed; a rule whose target
  host equals the source host is flagged as a likely loop.

## Docker & CI

- Multi-stage image: build stage compiles TypeScript with `tsup`; runtime is
  `node:22-alpine` plus the Caddy static binary and s6-overlay.
- Non-root `UID 1001`, `GID 0`, `chmod g=u` (wepublish OpenShift-compatible
  pattern). Exposes 80 and 443. `/data` volume for SQLite + certs.
- GitHub Actions workflow mirrors `wepublish-mcp/docker.yml`: Buildx → push to
  `ghcr.io/${{ github.repository }}` on pushes to `main` and `v*` tags, with
  GitHub Actions layer cache (`cache-from/to: type=gha`).

## Configuration (environment)

| var | purpose |
|---|---|
| `ADMIN_HOSTNAME` | host where the admin UI/OAuth is served |
| `CNAME_TARGET` | value operators point their CNAME at (defaults to `ADMIN_HOSTNAME`); used for the UI CNAME check |
| `ACME_EMAIL` | Let's Encrypt account email |
| `ACME_CA` | ACME directory URL — staging vs production (for testing) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth app credentials |
| `GITHUB_OAUTH_CALLBACK_URL` | OAuth redirect URL |
| `ALLOWED_GITHUB_ORG` | org whose members may log in |
| `SESSION_SECRET` | signs the session cookie |
| `DEV_ADMIN_USER` / `DEV_ADMIN_PASSWORD` | optional local dev login |
| `DATA_DIR` | data/cert directory (default `/data`) |

## Testing strategy

- **TDD** on the pure resolver: all rule modes, path/query preservation toggle,
  301 vs 302, 404 on no match.
- URL/host validation unit tests (absolute URL required, loop detection).
- Auth middleware tests with a mocked GitHub API (member vs non-member; dev
  login enabled/disabled).
- ACME / Caddy on-demand TLS verified manually against Let's Encrypt **staging**
  and Caddy's internal CA in local runs (not in unit tests).

## Out of scope (YAGNI)

- Wildcard/regex path matching (explicitly rejected — exact link rules only).
- Per-rule analytics / click tracking.
- Multi-tenant isolation / per-user domain ownership (single shared admin set).
- Catch-all default target per domain (unmatched link path → plain 404).
