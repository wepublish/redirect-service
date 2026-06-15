import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import { config } from "../config.ts";
import { normalizeHost } from "../validation.ts";

export function internalRoutes(repo: DomainsRepo) {
  const app = new Hono();

  // Caddy on-demand TLS "ask" endpoint: 200 = allowed to issue cert, 403 = no.
  app.get("/internal/tls-allowed", (c) => {
    const domain = normalizeHost(c.req.query("domain") ?? "");
    if (!domain) return c.text("missing domain", 400);
    const allowed = domain === normalizeHost(config.adminHostname) || repo.isAllowedDomain(domain);
    return allowed ? c.text("ok", 200) : c.text("not allowed", 403);
  });

  app.get("/healthz", (c) => c.text("ok"));
  return app;
}
