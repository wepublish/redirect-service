import { Hono } from "hono";
import type { DomainsRepo } from "../db/domains-repo.ts";
import type { ProjectsRepo } from "../db/projects-repo.ts";
import { requireAuth } from "../auth/middleware.ts";
import { layout } from "../ui/layout.ts";
import { renderDomainList, renderDomainEdit, renderProjects, renderNotFoundEditor } from "../ui/pages.ts";
import { checkCname } from "../dns/cname-check.ts";
import { getCertStatus } from "../tls/cert-info.ts";
import { config } from "../config.ts";
import { validateSourcePath, validateTargetUrl, normalizeHost } from "../validation.ts";
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
    return domains.map((domain, i) => ({
      domain,
      cname: statuses[i]!,
      cert: getCertStatus(domain.hostname),
    }));
  }

  const renderList = async (c: any, status: 200 | 400 = 200, error?: string) =>
    c.html(
      layout("Domains", renderDomainList(await listRows(), config.cnameTarget, projects.list(), error), {
        user: c.get("user"),
      }),
      status,
    );

  app.get("/admin", (c) => renderList(c));

  // ---- projects (own page) ----
  app.get("/admin/projects", (c) => {
    const counts = new Map<number, number>();
    for (const d of repo.listDomains()) {
      if (d.projectId != null) counts.set(d.projectId, (counts.get(d.projectId) ?? 0) + 1);
    }
    const items = projects.list().map((p) => ({ ...p, count: counts.get(p.id) ?? 0 }));
    return c.html(layout("Projects", renderProjects(items), { user: c.get("user") }));
  });

  app.post("/admin/projects", async (c) => {
    const b = await c.req.parseBody();
    const name = String(b.name ?? "").trim();
    if (name) projects.create(name);
    return c.redirect("/admin/projects");
  });

  app.post("/admin/projects/:id/rename", async (c) => {
    const b = await c.req.parseBody();
    const name = String(b.name ?? "").trim();
    if (name) projects.rename(Number(c.req.param("id")), name);
    return c.redirect("/admin/projects");
  });

  app.post("/admin/projects/:id/delete", (c) => {
    projects.delete(Number(c.req.param("id")));
    return c.redirect("/admin/projects");
  });

  // ---- domains ----
  app.post("/admin/domains", async (c) => {
    const form = await c.req.formData();
    const hostname = String(form.get("hostname") ?? "");
    const modeRaw = form.get("mode");
    const mode = modeRaw === "links" ? "links" : modeRaw === "static" ? "static" : "domain";
    // Reject a duplicate hostname with a clean message instead of a DB error.
    if (repo.getByHostname(hostname)) {
      return renderList(c, 400, `A domain "${normalizeHost(hostname)}" already exists.`);
    }
    let targetUrl: string | null = null;
    let htmlContent: string | null = null;
    if (mode === "domain") {
      targetUrl = String(form.get("targetUrl") ?? "");
      const v = validateTargetUrl(targetUrl, hostname);
      if (!v.ok) return renderList(c, 400, v.error);
    }
    if (mode === "static") {
      htmlContent = String(form.get("htmlContent") ?? "");
    }
    const domain = repo.createDomain({
      hostname,
      mode,
      targetUrl,
      preservePath: form.get("preservePath") === "on",
      redirectType: toRedirectType(form.get("redirectType")),
      projectId: parseProjectId(form.get("projectId")),
      htmlContent,
    });
    // Optional link rules supplied right in the create form (links mode).
    if (mode === "links") {
      const sources = form.getAll("linkSource[]");
      const targets = form.getAll("linkTarget[]");
      const types = form.getAll("linkType[]");
      const seen = new Set<string>();
      for (let i = 0; i < sources.length; i++) {
        const sourcePath = String(sources[i] ?? "").trim();
        const targetUrlRow = String(targets[i] ?? "").trim();
        if (!sourcePath && !targetUrlRow) continue; // skip blank rows
        if (seen.has(sourcePath)) continue; // skip duplicate path within this submit
        if (validateSourcePath(sourcePath).ok && validateTargetUrl(targetUrlRow, hostname).ok) {
          seen.add(sourcePath);
          repo.addLink(domain.id, {
            sourcePath,
            targetUrl: targetUrlRow,
            redirectType: toRedirectType(types[i]),
          });
        }
      }
    }
    return c.redirect("/admin");
  });

  app.get("/admin/domains/:id", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const cname = await checkCname(domain.hostname, config.cnameTarget);
    return c.html(
      layout(
        domain.hostname,
        renderDomainEdit(domain, cname, config.cnameTarget, projects.list(), getCertStatus(domain.hostname)),
        { user: c.get("user") },
      ),
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
        layout(
          domain.hostname,
          renderDomainEdit(domain, cname, config.cnameTarget, projects.list(), getCertStatus(domain.hostname), v.error),
          { user: c.get("user") },
        ),
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

  app.get("/admin/domains/:id/404", (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const isCustom = !!domain.notFoundHtml;
    return c.html(
      layout(`404 · ${domain.hostname}`, renderNotFoundEditor(domain, domain.notFoundHtml ?? "", isCustom), {
        user: c.get("user"),
      }),
    );
  });

  app.post("/admin/domains/:id/notfound", async (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    const b = await c.req.parseBody();
    const html = String(b.notFoundHtml ?? "").trim();
    repo.updateNotFoundHtml(domain.id, html || null);
    return c.redirect(`/admin/domains/${domain.id}`);
  });

  app.post("/admin/domains/:id/notfound/clear", (c) => {
    const domain = repo.getById(Number(c.req.param("id")));
    if (!domain) return c.notFound();
    repo.updateNotFoundHtml(domain.id, null);
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
    const dup = domain.links.some((l) => l.sourcePath === sourcePath)
      ? `A rule for "${sourcePath}" already exists on this domain.`
      : null;
    if (!ps.ok || !vt.ok || dup) {
      const cname = await checkCname(domain.hostname, config.cnameTarget);
      const msg = dup ?? (!ps.ok ? ps.error : (vt as { ok: false; error: string }).error);
      return c.html(
        layout(
          domain.hostname,
          renderDomainEdit(domain, cname, config.cnameTarget, projects.list(), getCertStatus(domain.hostname), msg),
          { user: c.get("user") },
        ),
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
