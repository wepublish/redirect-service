# redirect-service

Configurable HTTP redirect service with a GitHub-OAuth-gated admin UI and
automatic Let's Encrypt TLS for any domain pointed at it via CNAME.

## How it works

Caddy terminates TLS and obtains certificates on-demand, gated by an allowlist
endpoint (`/internal/tls-allowed`) so it only issues for domains you've
registered. A Bun + Hono app resolves redirects, serves the admin UI, and handles
auth. State lives in SQLite + Caddy's cert cache on the `/data` volume.

Both processes run in one **non-root** container: Caddy binds the unprivileged
ports 8080/4443, and Docker publishes host 80→8080 and 443→4443 (the Docker
daemon, already root, binds the privileged host ports). A small entrypoint script
supervises Bun + Caddy; an init (`--init` / compose `init: true`) is PID1 for
signal-forwarding and reaping.

## Redirect kinds

- **Whole-domain**: `old.com/*` → `new.com` (path/query preserved by default,
  per-rule toggle to drop it).
- **Exact link**: `old.com/promo` → `shop.com/sale` (exact path; unmatched → 404).
- Each is **301 (permanent)** or **302 (temporary)**.

## Setup

1. Create a GitHub OAuth app; set the callback to
   `https://<ADMIN_HOSTNAME>/auth/github/callback`.
2. Point `<ADMIN_HOSTNAME>` and every redirect domain's CNAME at this service's
   public host. A cert is issued automatically on the first HTTPS request once
   the domain is registered in the UI.
3. Configure env (see `.env.example`).

## Run locally

```bash
bun install
cp .env.example .env   # fill in values; set DEV_ADMIN_USER/PASSWORD for local login
bun run dev
```

With `DEV_ADMIN_USER`/`DEV_ADMIN_PASSWORD` set the app serves a dev login and
relaxes the secure-cookie flag (local plain HTTP). Visit
`http://localhost:3000/login` with the `Host` header matching `ADMIN_HOSTNAME`.

## Test

```bash
bun test          # unit tests
bun run typecheck # tsc --noEmit
```

## Docker

With docker-compose (recommended — handles the 80→8080 / 443→4443 mapping and
`init`):

```bash
cp .env.example .env   # fill in values
docker compose up -d --build
```

Or plain `docker run` (note the port mapping and `--init`):

```bash
docker build -t redirect-service .
docker run --init -p 80:8080 -p 443:4443 -v rs-data:/data --env-file .env redirect-service
```

Use `ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory` while testing
to avoid Let's Encrypt rate limits. CI builds and pushes the image to
`ghcr.io/<owner>/redirect-service` on pushes to `main` and `v*` tags.

## Configuration

See [.env.example](.env.example) for all variables. Notable ones:

| var | purpose |
|---|---|
| `ADMIN_HOSTNAME` | host where the admin UI/OAuth is served |
| `CNAME_TARGET` | value operators point their CNAME at (defaults to `ADMIN_HOSTNAME`) |
| `ACME_EMAIL` / `ACME_CA` | Let's Encrypt account email / directory URL |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_CALLBACK_URL` | OAuth app |
| `ALLOWED_GITHUB_ORG` | GitHub org whose members may log in |
| `SESSION_SECRET` | signs the session cookie |
| `DEV_ADMIN_USER` / `DEV_ADMIN_PASSWORD` | optional local dev login |
| `COOKIE_SECURE` | force secure cookies on/off (default: on unless dev login set) |
| `DATA_DIR` | data/cert directory (default `/data`) |
