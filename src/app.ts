import { Hono } from "hono";
import type { DomainsRepo } from "./db/domains-repo.ts";
import { config } from "./config.ts";
import { normalizeHost } from "./validation.ts";
import { internalRoutes } from "./routes/internal.ts";
import { authRoutes } from "./routes/auth-routes.ts";
import { adminRoutes } from "./routes/admin.ts";
import { redirectRoutes } from "./routes/redirect.ts";

export function createApp(repo: DomainsRepo) {
  const app = new Hono();

  // /internal + /healthz are always available (Caddy calls them on localhost).
  app.route("/", internalRoutes(repo));

  const adminApp = new Hono();
  adminApp.route("/", authRoutes());
  adminApp.route("/", adminRoutes(repo));
  adminApp.get("/", (c) => c.redirect("/admin"));

  const redirectApp = redirectRoutes(repo);

  // Dispatch by Host header.
  app.all("*", (c) => {
    const host = normalizeHost(c.req.header("host") ?? "");
    const isAdminHost = host === normalizeHost(config.adminHostname);
    return (isAdminHost ? adminApp : redirectApp).fetch(c.req.raw);
  });

  return app;
}
