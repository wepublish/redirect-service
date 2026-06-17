import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import { resolve } from "../redirect/resolver.ts";
import { normalizeHost } from "../validation.ts";

export function redirectRoutes(repo: DomainsRepo) {
  const app = new Hono();
  app.all("*", (c) => {
    const host = normalizeHost(c.req.header("host") ?? "");
    const url = new URL(c.req.url);
    const domain = repo.getByHostname(host);

    // Static mode: serve the stored HTML on every path.
    if (domain?.mode === "static") {
      return c.html(domain.htmlContent ?? "", 200);
    }

    const result = resolve(domain, url.pathname, url.search);
    if (result.status === 404) return c.text("Not found", 404);
    return c.redirect(result.location, result.status);
  });
  return app;
}
