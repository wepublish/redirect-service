import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import { config } from "../config.ts";
import { normalizeHost } from "../validation.ts";
import { checkCname } from "../dns/cname-check.ts";

export function internalRoutes(repo: DomainsRepo) {
  const app = new Hono();

  // Caddy on-demand TLS "ask" endpoint: 200 = allowed to issue cert, 403 = no.
  app.get("/internal/tls-allowed", async (c) => {
    const domain = normalizeHost(c.req.query("domain") ?? "");
    if (!domain) return c.text("missing domain", 400);

    // The admin host needs its own cert and has no CNAME to itself.
    if (domain === normalizeHost(config.adminHostname)) return c.text("ok", 200);

    // Other domains must be registered AND have a correct CNAME pointing at us
    // (verified via 1.1.1.1) before we let Caddy obtain a certificate.
    if (!repo.isAllowedDomain(domain)) return c.text("not allowed", 403);
    const cname = await checkCname(domain, config.cnameTarget);
    if (!cname.ok) return c.text(`cname not pointing to ${config.cnameTarget}`, 403);
    return c.text("ok", 200);
  });

  app.get("/healthz", (c) => c.text("ok"));
  return app;
}
