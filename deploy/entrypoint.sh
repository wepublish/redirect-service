#!/usr/bin/env bash
# Supervises the two processes (Bun app + Caddy) in one non-root container.
# Container reaping/signal-forwarding is handled by an init (compose `init: true`
# or `docker run --init`). If either process exits, stop the other so the
# container exits and the orchestrator can restart it.
set -uo pipefail

term() {
  kill -TERM "${APP_PID:-}" "${CADDY_PID:-}" 2>/dev/null || true
}
trap term TERM INT

bun run /app/src/server.ts &
APP_PID=$!

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

# Exit as soon as either process dies.
wait -n
EXIT=$?
term
wait
exit "$EXIT"
