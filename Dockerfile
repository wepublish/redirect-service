# syntax=docker/dockerfile:1
FROM oven/bun:1-debian AS base

# --- system deps: caddy (TLS/ACME) ---
ARG CADDY_VERSION=2.8.4
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar bash \
  && rm -rf /var/lib/apt/lists/*

# caddy (static binary)
ADD https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz /tmp/caddy.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/caddy.tar.gz caddy && rm /tmp/caddy.tar.gz && chmod +x /usr/local/bin/caddy

WORKDIR /app

# install production deps (only package.json/lockfile changes bust this layer)
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile || bun install --production

# app source + runtime config
COPY src ./src
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Caddy stores certs/config under these dirs; keep them on the data volume.
ENV DATA_DIR=/data PORT=3000 \
    XDG_DATA_HOME=/data/caddy XDG_CONFIG_HOME=/data/caddy

# OpenShift-compatible non-root: fixed UID 1001 in group 0, group bits = user
# bits so an arbitrary injected UID (also in group 0) can read/write.
RUN mkdir -p /data/caddy \
  && chown -R 1001:0 /app /data \
  && chmod -R g=u /app /data
USER 1001

# Unprivileged ports; Docker publishes host 80->8080 and 443->4443.
EXPOSE 8080 4443
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
