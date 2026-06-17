import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import type { ProjectsRepo } from "../db/projects-repo.ts";
import { requireAuth } from "../auth/middleware.ts";
import { layout } from "../ui/layout.ts";
import { renderDomainList, renderDomainEdit } from "../ui/pages.ts";
import { checkCname } from "../dns/cname-check.ts";
import { config } from "../config.ts";
import { validateSourcePath, validateTargetUrl } from "../validation.ts";
import { toRedirectType } from "../redirect/resolver.ts";

function parseProjectId(v: unknown): number | null {
  const n = Number(v);
  return v && Number.isFinite(n) ? n : null;
}

export function adminRoutes(repo: DomainsRepo, projects: ProjectsRepo) {
  const app = new Hono<{ Variables: { user: string } }>();
  app.use("*", requireAuth);

  async function listRows() {
    const domains = repo.listDomains();
    const statuses = await Promise.all(
      domains.map((d) => checkCname(d.hostname, config.cnameTarget)),
    );
    return domains.map((domain, i) => ({ domain, cname: statuses[i]! }));
  }

  const renderList = async (c: any, status: 200 | 400 = 200) =>
    c.html(
      layout("Domains", renderDomainList(await listRows(), config.cnameTarget, projects.list()), {
        user: c.get("user"),
      }),
      status,
    );

  app.get("/admin", (c) => renderList(c));

  // ---- projects ----
  app.post("/admin/projects", async (c) => {
    const b = await c.req.parseBody();
    const name = String(b.name ?? "").trim();
    if (name) projects.create(name);
    return c.redirect("/admin");
  });

  app.post("/admin/projects/:id/rename", async (c) => {
    const b = await c.req.parseBody();
    const name = String(b.name ?? "").trim();
    if (name) projects.rename(Number(c.req.param("id")), name);
    return c.redirect("/admin");
  });

  app.post("/admin/projects/:id/delete", (c) => {
    projects.delete(Number(c.req.param("id")));
    return c.redirect("/admin");
  });

  // ---- domains ----
  app.post("/admin/domains", async (c) => {
    const b = await c.req.parseBody();
    const hostname = String(b.hostname ?? "");
    const mode = b.mode === "links" ? "links" : b.mode === "static" ? "static" : "domain";
    let targetUrl: string | null = null;
    let htmlContent: string | null = null;
    if (mode === "domain") {
      targetUrl = String(b.targetUrl ?? "");
      const v = validateTargetUrl(targetUrl, hostname);
      if (!v.ok) return renderList(c, 400);
    }
    if (mode === "static") {
      htmlContent = String(b.htmlContent ?? "");
    }
    repo.createDomain({
      hostname,
      mode,
      targetUrl,
      preservePath: b.preservePath === "on",
      redirectType: toRedirectType(b.redirectType),
      projectId: parseProjectId(b.projectId),
      htmlContent,
    });
    return c.redirect("/admin");
  });

  app.get("/admin/domains/:id", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const cname = await checkCname(domain.hostname, config.cnameTarget);
    return c.html(
      layout(domain.hostname, renderDomainEdit(domain, cname, config.cnameTarget, projects.list()), {
        user: c.get("user"),
      }),
    );
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
        layout(domain.hostname, renderDomainEdit(domain, cname, config.cnameTarget, projects.list(), v.error), {
          user: c.get("user"),
        }),
        400,
      );
    }
    repo.updateDomainTarget(domain.id, targetUrl, b.preservePath === "on", toRedirectType(b.redirectType));
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/domains/:id/static", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const b = await c.req.parseBody();
    repo.updateStaticHtml(domain.id, String(b.htmlContent ?? ""));
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/domains/:id/project", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const b = await c.req.parseBody();
    repo.setDomainProject(domain.id, parseProjectId(b.projectId));
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
        layout(domain.hostname, renderDomainEdit(domain, cname, config.cnameTarget, projects.list(), msg), {
          user: c.get("user"),
        }),
        400,
      );
    }
    repo.addLink(domain.id, { sourcePath, targetUrl, redirectType: toRedirectType(b.redirectType) });
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/links/:id/delete", (c) => {
    repo.deleteLink(Number(c.req.param("id")));
    return c.redirect(c.req.header("referer") ?? "/admin");
  });

  return app;
}
