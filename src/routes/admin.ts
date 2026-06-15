import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import { requireAuth } from "../auth/middleware.ts";
import { layout } from "../ui/layout.ts";
import { renderDomainList, renderDomainEdit } from "../ui/pages.ts";
import { checkCname } from "../dns/cname-check.ts";
import { config } from "../config.ts";
import { validateSourcePath, validateTargetUrl } from "../validation.ts";
import type { RedirectType } from "../redirect/resolver.ts";

function parseType(v: unknown): RedirectType {
  return v === "302" ? 302 : 301;
}

export function adminRoutes(repo: DomainsRepo) {
  const app = new Hono<{ Variables: { user: string } }>();
  app.use("*", requireAuth);

  app.get("/admin", (c) =>
    c.html(layout("Domains", renderDomainList(repo.listDomains()), { user: c.get("user") })),
  );

  app.post("/admin/domains", async (c) => {
    const b = await c.req.parseBody();
    const hostname = String(b.hostname ?? "");
    const mode = b.mode === "links" ? "links" : "domain";
    let targetUrl: string | null = null;
    if (mode === "domain") {
      targetUrl = String(b.targetUrl ?? "");
      const v = validateTargetUrl(targetUrl, hostname);
      if (!v.ok)
        return c.html(
          layout("Domains", renderDomainList(repo.listDomains()), { user: c.get("user") }),
          400,
        );
    }
    repo.createDomain({
      hostname,
      mode,
      targetUrl,
      preservePath: b.preservePath === "on",
      redirectType: parseType(b.redirectType),
    });
    return c.redirect("/admin");
  });

  app.get("/admin/domains/:id", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const cname = await checkCname(domain.hostname, config.cnameTarget);
    return c.html(layout(domain.hostname, renderDomainEdit(domain, cname), { user: c.get("user") }));
  });

  app.post("/admin/domains/:id/update", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const b = await c.req.parseBody();
    const targetUrl = String(b.targetUrl ?? "");
    const v = validateTargetUrl(targetUrl, domain.hostname);
    if (!v.ok) {
      const cname = await checkCname(domain.hostname, config.cnameTarget);
      return c.html(
        layout(domain.hostname, renderDomainEdit(domain, cname, v.error), { user: c.get("user") }),
        400,
      );
    }
    repo.updateDomainTarget(domain.id, targetUrl, b.preservePath === "on", parseType(b.redirectType));
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/domains/:id/delete", (c) => {
    repo.deleteDomain(Number(c.req.param("id")));
    return c.redirect("/admin");
  });

  app.post("/admin/domains/:id/links", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const b = await c.req.parseBody();
    const sourcePath = String(b.sourcePath ?? "");
    const targetUrl = String(b.targetUrl ?? "");
    const ps = validateSourcePath(sourcePath);
    const vt = validateTargetUrl(targetUrl, domain.hostname);
    if (!ps.ok || !vt.ok) {
      const cname = await checkCname(domain.hostname, config.cnameTarget);
      const msg = !ps.ok ? ps.error : (vt as { ok: false; error: string }).error;
      return c.html(
        layout(domain.hostname, renderDomainEdit(domain, cname, msg), { user: c.get("user") }),
        400,
      );
    }
    repo.addLink(domain.id, { sourcePath, targetUrl, redirectType: parseType(b.redirectType) });
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/links/:id/delete", (c) => {
    repo.deleteLink(Number(c.req.param("id")));
    return c.redirect(c.req.header("referer") ?? "/admin");
  });

  return app;
}
