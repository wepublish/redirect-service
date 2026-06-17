import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { StoredDomain } from "../db/domains-repo.ts";
import type { CnameStatus } from "../dns/cname-check.ts";
import type { Project } from "../db/projects-repo.ts";
import { REDIRECT_TYPES, type RedirectType } from "../redirect/resolver.ts";

export interface DomainRow {
  domain: StoredDomain;
  cname: CnameStatus;
}

function typeBadge(type: RedirectType) {
  const meta = REDIRECT_TYPES.find((t) => t.code === type)!;
  return html`<span class="badge ${meta.permanent ? "badge-301" : "badge-302"}" title="${meta.summary}">${type} ${meta.label}</span>`;
}

function dnsClass(cname: CnameStatus): "ok" | "bad" | "unknown" {
  if (cname.ok) return "ok";
  return cname.state === "error" ? "unknown" : "bad";
}

function modeBadge(mode: StoredDomain["mode"]) {
  if (mode === "domain") return html`<span class="badge badge-domain">Whole domain</span>`;
  if (mode === "static") return html`<span class="badge badge-static">Static page</span>`;
  return html`<span class="badge badge-links">Links</span>`;
}

/** Compact code badge (just the number) for the overview table. */
function codeBadge(type: RedirectType) {
  const meta = REDIRECT_TYPES.find((t) => t.code === type)!;
  return html`<span class="badge ${meta.permanent ? "badge-301" : "badge-302"}" title="${meta.label} — ${meta.summary}">${type}</span>`;
}

/** The redirect code(s) for a domain row — nothing for static pages. */
function codeCell(d: StoredDomain) {
  if (d.mode === "domain") return codeBadge(d.redirectType);
  if (d.mode === "links") {
    const codes = [...new Set(d.links.map((l) => l.redirectType))].sort((a, b) => a - b);
    return codes.length ? html`${codes.map((c) => codeBadge(c))}` : html`<span class="muted">—</span>`;
  }
  return html`<span class="muted">—</span>`;
}

/** Lowercased haystack for client-side search: host + any targets/paths. */
function searchText(d: StoredDomain): string {
  const parts = [d.hostname];
  if (d.mode === "domain" && d.targetUrl) parts.push(d.targetUrl);
  if (d.mode === "links") for (const l of d.links) parts.push(l.sourcePath, l.targetUrl);
  return parts.join(" ").toLowerCase();
}

function redirectTypeOptions(selected: RedirectType = 301) {
  return html`${REDIRECT_TYPES.map(
    (t) =>
      html`<option value="${t.code}" ${t.code === selected ? "selected" : ""}>${t.code} — ${t.label}</option>`,
  )}`;
}

function redirectTypeLegend() {
  return html`<details class="hint legend" style="margin-top:.6rem">
    <summary>What do the redirect codes mean?</summary>
    <ul>
      ${REDIRECT_TYPES.map((t) => html`<li><strong>${t.code} ${t.label}</strong> — ${t.summary}</li>`)}
    </ul>
  </details>`;
}

function projectOptions(projects: Project[], selected: number | null) {
  return html`
    <option value="" ${selected == null ? "selected" : ""}>— Unassigned —</option>
    ${projects.map(
      (p) => html`<option value="${p.id}" ${selected === p.id ? "selected" : ""}>${p.name}</option>`,
    )}
  `;
}

export function renderLogin(devLoginEnabled: boolean, error?: string) {
  return html`
    <div class="login-wrap">
      <div class="card login-card">
        <div class="card-body">
          <div class="login-title">
            <h1>Welcome back</h1>
            <p class="sub">Sign in to manage redirects</p>
          </div>
          ${error ? html`<div class="alert alert-error">${error}</div>` : ""}
          <a class="btn btn-primary btn-block" href="/auth/github">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
                1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
                0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0
                1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0
                3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01
                8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Sign in with GitHub
          </a>
          ${devLoginEnabled
            ? html`
                <div class="divider">or</div>
                <form method="post" action="/auth/dev-login">
                  <div class="field">
                    <span class="label">Username</span>
                    <input name="user" autocomplete="username" />
                  </div>
                  <div class="field">
                    <span class="label">Password</span>
                    <input name="password" type="password" autocomplete="current-password" />
                  </div>
                  <button class="btn btn-secondary btn-block" type="submit">Dev login</button>
                </form>`
            : ""}
        </div>
      </div>
    </div>
  `;
}

function domainRowTr({ domain: d, cname }: DomainRow) {
  return html`<tr data-search="${searchText(d)}">
    <td><span class="dot-only ${dnsClass(cname)}" title="${cname.detail}"></span></td>
    <td><a class="mono" href="/admin/domains/${d.id}">${d.hostname}</a></td>
    <td>${modeBadge(d.mode)}</td>
    <td>${codeCell(d)}</td>
    <td class="truncate mono">
      ${d.mode === "domain"
        ? d.targetUrl
        : d.mode === "static"
          ? "HTML page"
          : `${d.links.length} rule${d.links.length === 1 ? "" : "s"}`}
    </td>
    <td class="actions">
      <form class="inline" method="post" action="/admin/domains/${d.id}/delete"
            onsubmit="return confirm('Delete ${d.hostname} and all its rules?')">
        <button class="btn btn-danger btn-sm" type="submit">Delete</button>
      </form>
    </td>
  </tr>`;
}

function folder(title: HtmlEscapedString | string, rows: DomainRow[]) {
  return html`<details class="card folder">
    <summary>
      <span class="folder-name">📁 ${title}</span>
      <span class="count">${rows.length}</span>
    </summary>
    ${rows.length === 0
      ? html`<div class="empty"><p>No domains in here yet — pick this project when adding a domain.</p></div>`
      : html`<table>
          <thead><tr><th>DNS</th><th>Host</th><th>Mode</th><th>Code</th><th>Target / rules</th><th></th></tr></thead>
          <tbody>${rows.map(domainRowTr)}</tbody>
        </table>`}
  </details>`;
}

export function renderDomainList(rows: DomainRow[], cnameTarget: string, projects: Project[]) {
  const groups = new Map<number | null, DomainRow[]>();
  for (const r of rows) {
    const key = r.domain.projectId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const unassigned = groups.get(null) ?? [];

  return html`
    <div class="container stack">
      <div class="page-head">
        <h1>Domains</h1>
        <p class="sub">Organize redirects into projects. Point each host's CNAME at this service to get an automatic certificate. The DNS dot shows whether the CNAME is correct (checked via 1.1.1.1).</p>
      </div>

      <div class="field" style="margin:0">
        <input type="search" placeholder="Search domain or target…" oninput="rsFilter(this.value)" autocomplete="off" />
      </div>
      <script>
        function rsFilter(q) {
          q = (q || "").trim().toLowerCase();
          document.querySelectorAll("details.folder").forEach(function (f) {
            var any = false;
            f.querySelectorAll("tbody tr[data-search]").forEach(function (tr) {
              var m = !q || tr.getAttribute("data-search").indexOf(q) >= 0;
              tr.style.display = m ? "" : "none";
              if (m) any = true;
            });
            f.style.display = !q || any ? "" : "none";
            f.open = q ? any : false;
          });
        }
      </script>

      <div class="card">
        <div class="card-head"><h3>Projects</h3><p class="sub">Group your domains into folders.</p></div>
        <div class="card-body">
          <form class="form-row" method="post" action="/admin/projects" style="margin-bottom:${projects.length ? "1rem" : "0"}">
            <div class="field" style="flex:1 1 240px">
              <span class="label">New project</span>
              <input name="name" placeholder="e.g. Marketing campaigns" required />
            </div>
            <button class="btn btn-primary" type="submit">Create project</button>
          </form>
          ${projects.length === 0
            ? ""
            : html`<table>
                <thead><tr><th>Project</th><th>Domains</th><th></th></tr></thead>
                <tbody>
                  ${projects.map(
                    (p) => html`<tr>
                      <td>
                        <form class="form-row" method="post" action="/admin/projects/${p.id}/rename" style="gap:.4rem">
                          <input name="name" value="${p.name}" style="max-width:280px" />
                          <button class="btn btn-secondary btn-sm" type="submit">Rename</button>
                        </form>
                      </td>
                      <td>${groups.get(p.id)?.length ?? 0}</td>
                      <td class="actions">
                        <form class="inline" method="post" action="/admin/projects/${p.id}/delete"
                              onsubmit="return confirm('Delete project ${p.name}? Its domains move to Unassigned.')">
                          <button class="btn btn-danger btn-sm" type="submit">Delete</button>
                        </form>
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>`}
        </div>
      </div>

      ${rows.length === 0
        ? html`<div class="card"><div class="empty"><div class="icon">🌐</div><p>No domains yet. Add one below to get started.</p></div></div>`
        : html`
            ${unassigned.length ? folder("Unassigned", unassigned) : ""}
            ${projects.map((p) => folder(p.name, groups.get(p.id) ?? []))}
          `}

      <div class="card">
        <div class="card-head">
          <h3>Add a domain</h3>
          <p class="sub">Choose whole-domain to forward everything, or links for exact path rules.</p>
        </div>
        <div class="card-body">
          <p class="hint" style="margin-bottom:1rem">
            To configure a domain, create a DNS <strong>CNAME</strong> record pointing it to
            <span class="mono">${cnameTarget}</span> (for apex/root domains use an
            <strong>ALIAS</strong>/<strong>ANAME</strong> or an A record to the same address) —
            the certificate is then issued automatically.
          </p>
          <form method="post" action="/admin/domains">
            <div class="grid-2">
              <div class="field">
                <span class="label">Hostname</span>
                <input name="hostname" placeholder="old.example.com" required />
              </div>
              <div class="field">
                <span class="label">Mode</span>
                <select name="mode" onchange="var m=this.value;document.getElementById('domain-settings').style.display=m==='domain'?'':'none';document.getElementById('static-settings').style.display=m==='static'?'':'none'">
                  <option value="domain">Whole-domain redirect</option>
                  <option value="links">Exact link redirects</option>
                  <option value="static">Static HTML page</option>
                </select>
              </div>
            </div>
            <div id="static-settings" style="display:none">
              <div class="field">
                <span class="label">HTML content</span>
                <textarea name="htmlContent" rows="10" class="mono" placeholder="&lt;!doctype html&gt;&#10;&lt;h1&gt;Coming soon&lt;/h1&gt;"></textarea>
                <span class="hint">Served as <code>text/html</code> on every path of this host.</span>
              </div>
            </div>
            <div class="field">
              <span class="label">Project</span>
              <select name="projectId">${projectOptions(projects, null)}</select>
            </div>
            <div id="domain-settings">
              <div class="field">
                <span class="label">Target URL</span>
                <input name="targetUrl" placeholder="https://new.example.com" />
                <span class="hint">Where the whole domain should redirect to.</span>
              </div>
              <div class="grid-2">
                <div class="field">
                  <span class="label">Redirect type</span>
                  <select name="redirectType">${redirectTypeOptions()}</select>
                </div>
                <div class="field">
                  <span class="label">Path handling</span>
                  <label class="check"><input type="checkbox" name="preservePath" checked /> Preserve path &amp; query</label>
                </div>
              </div>
              ${redirectTypeLegend()}
            </div>
            <button class="btn btn-primary" type="submit">Add domain</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function renderDomainEdit(
  domain: StoredDomain,
  cname: CnameStatus,
  cnameTarget: string,
  projects: Project[],
  error?: string,
) {
  return html`
    <div class="container stack">
      <div>
        <a class="back" href="/admin">← All domains</a>
        <div class="page-head" style="margin-bottom:0">
          <h1 class="mono">${domain.hostname}</h1>
          <p class="sub">
            ${modeBadge(domain.mode)}
            <span class="pill ${dnsClass(cname)}" style="margin-left:.5rem">
              <span class="dot"></span> ${cname.detail}
            </span>
          </p>
          <p class="hint" style="margin-top:.5rem">
            Configure DNS: point a <strong>CNAME</strong> record for
            <span class="mono">${domain.hostname}</span> to
            <span class="mono">${cnameTarget}</span>
            (apex/root domains: use an <strong>ALIAS</strong>/<strong>ANAME</strong> or A record to the same address).
          </p>
        </div>
      </div>

      ${error ? html`<div class="alert alert-error">${error}</div>` : ""}

      <div class="card">
        <div class="card-head"><h3>Project</h3></div>
        <div class="card-body">
          <form class="form-row" method="post" action="/admin/domains/${domain.id}/project">
            <div class="field" style="flex:1 1 240px">
              <span class="label">Folder</span>
              <select name="projectId">${projectOptions(projects, domain.projectId)}</select>
            </div>
            <button class="btn btn-secondary" type="submit">Move</button>
          </form>
        </div>
      </div>

      ${domain.mode === "static"
        ? html`<div class="card">
            <div class="card-head">
              <h3>Static HTML</h3>
              <p class="sub">Served as <code>text/html</code> on every path of this host.</p>
            </div>
            <div class="card-body">
              <form method="post" action="/admin/domains/${domain.id}/static">
                <div class="field">
                  <textarea name="htmlContent" rows="18" class="mono">${domain.htmlContent ?? ""}</textarea>
                </div>
                <button class="btn btn-primary" type="submit">Save HTML</button>
              </form>
            </div>
          </div>`
        : domain.mode === "domain"
        ? html`<div class="card">
            <div class="card-head"><h3>Redirect settings</h3></div>
            <div class="card-body">
              <form method="post" action="/admin/domains/${domain.id}/update">
                <div class="field">
                  <span class="label">Target URL</span>
                  <input name="targetUrl" value="${domain.targetUrl ?? ""}" required />
                </div>
                <div class="grid-2">
                  <div class="field">
                    <span class="label">Redirect type</span>
                    <select name="redirectType">${redirectTypeOptions(domain.redirectType)}</select>
                  </div>
                  <div class="field">
                    <span class="label">Path handling</span>
                    <label class="check"><input type="checkbox" name="preservePath" ${domain.preservePath ? "checked" : ""} /> Preserve path &amp; query</label>
                  </div>
                </div>
                ${redirectTypeLegend()}
                <button class="btn btn-primary" type="submit">Save changes</button>
              </form>
            </div>
          </div>`
        : html`
            <div class="card">
              <div class="card-head"><h3>Link redirects</h3></div>
              ${domain.links.length === 0
                ? html`<div class="empty"><div class="icon">🔗</div><p>No link rules yet.</p></div>`
                : html`<table>
                    <thead><tr><th>Source path</th><th>Target URL</th><th>Type</th><th></th></tr></thead>
                    <tbody>
                      ${domain.links.map(
                        (l) => html`<tr>
                          <td class="mono">${l.sourcePath}</td>
                          <td class="truncate mono">${l.targetUrl}</td>
                          <td>${typeBadge(l.redirectType)}</td>
                          <td class="actions">
                            <form class="inline" method="post" action="/admin/links/${l.id}/delete">
                              <button class="btn btn-danger btn-sm" type="submit">Delete</button>
                            </form>
                          </td>
                        </tr>`,
                      )}
                    </tbody>
                  </table>`}
            </div>

            <div class="card">
              <div class="card-head"><h3>Add a link</h3></div>
              <div class="card-body">
                <form method="post" action="/admin/domains/${domain.id}/links">
                  <div class="form-row">
                    <div class="field">
                      <span class="label">Source path</span>
                      <input name="sourcePath" placeholder="/promo" required />
                    </div>
                    <div class="field">
                      <span class="label">Target URL</span>
                      <input name="targetUrl" placeholder="https://shop.com/sale" required />
                    </div>
                    <div class="field" style="flex:0 0 220px">
                      <span class="label">Type</span>
                      <select name="redirectType">${redirectTypeOptions()}</select>
                    </div>
                    <button class="btn btn-primary" type="submit">Add link</button>
                  </div>
                  ${redirectTypeLegend()}
                </form>
              </div>
            </div>
          `}
    </div>
  `;
}
