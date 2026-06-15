import { html } from "hono/html";
import type { StoredDomain } from "../db/domains-repo.ts";

function typeBadge(type: 301 | 302) {
  return type === 301
    ? html`<span class="badge badge-301">301 Permanent</span>`
    : html`<span class="badge badge-302">302 Temporary</span>`;
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

export function renderDomainList(domains: StoredDomain[]) {
  return html`
    <div class="container stack">
      <div class="page-head">
        <h1>Domains</h1>
        <p class="sub">Redirects are served for each registered host. Point its CNAME at this service to get an automatic certificate.</p>
      </div>

      <div class="card">
        <div class="card-head"><h2>Configured domains</h2></div>
        ${domains.length === 0
          ? html`<div class="empty">
              <div class="icon">🌐</div>
              <p>No domains yet. Add one below to get started.</p>
            </div>`
          : html`<table>
              <thead><tr><th>Host</th><th>Mode</th><th>Target / rules</th><th></th></tr></thead>
              <tbody>
                ${domains.map(
                  (d) => html`<tr>
                    <td><a class="mono" href="/admin/domains/${d.id}">${d.hostname}</a></td>
                    <td>
                      ${d.mode === "domain"
                        ? html`<span class="badge badge-domain">Whole domain</span>`
                        : html`<span class="badge badge-links">Links</span>`}
                    </td>
                    <td class="truncate mono">
                      ${d.mode === "domain"
                        ? d.targetUrl
                        : `${d.links.length} rule${d.links.length === 1 ? "" : "s"}`}
                    </td>
                    <td class="actions">
                      <form class="inline" method="post" action="/admin/domains/${d.id}/delete"
                            onsubmit="return confirm('Delete ${d.hostname} and all its rules?')">
                        <button class="btn btn-danger btn-sm" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>`,
                )}
              </tbody>
            </table>`}
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Add a domain</h3>
          <p class="sub">Choose whole-domain to forward everything, or links for exact path rules.</p>
        </div>
        <div class="card-body">
          <form method="post" action="/admin/domains">
            <div class="grid-2">
              <div class="field">
                <span class="label">Hostname</span>
                <input name="hostname" placeholder="old.example.com" required />
              </div>
              <div class="field">
                <span class="label">Mode</span>
                <select name="mode" onchange="document.getElementById('domain-settings').style.display = this.value === 'domain' ? '' : 'none'">
                  <option value="domain">Whole-domain redirect</option>
                  <option value="links">Exact link redirects</option>
                </select>
              </div>
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
                  <select name="redirectType">
                    <option value="301">301 Permanent</option>
                    <option value="302">302 Temporary</option>
                  </select>
                </div>
                <div class="field">
                  <span class="label">Path handling</span>
                  <label class="check"><input type="checkbox" name="preservePath" checked /> Preserve path &amp; query</label>
                </div>
              </div>
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
  cname: { ok: boolean; detail: string },
  error?: string,
) {
  return html`
    <div class="container stack">
      <div>
        <a class="back" href="/admin">← All domains</a>
        <div class="page-head" style="margin-bottom:0">
          <h1 class="mono">${domain.hostname}</h1>
          <p class="sub">
            ${domain.mode === "domain"
              ? html`<span class="badge badge-domain">Whole domain</span>`
              : html`<span class="badge badge-links">Links</span>`}
            <span class="pill ${cname.ok ? "ok" : "bad"}" style="margin-left:.5rem">
              <span class="dot"></span> ${cname.detail}
            </span>
          </p>
        </div>
      </div>

      ${error ? html`<div class="alert alert-error">${error}</div>` : ""}

      ${domain.mode === "domain"
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
                    <select name="redirectType">
                      <option value="301" ${domain.redirectType === 301 ? "selected" : ""}>301 Permanent</option>
                      <option value="302" ${domain.redirectType === 302 ? "selected" : ""}>302 Temporary</option>
                    </select>
                  </div>
                  <div class="field">
                    <span class="label">Path handling</span>
                    <label class="check"><input type="checkbox" name="preservePath" ${domain.preservePath ? "checked" : ""} /> Preserve path &amp; query</label>
                  </div>
                </div>
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
                    <div class="field" style="flex:0 0 160px">
                      <span class="label">Type</span>
                      <select name="redirectType">
                        <option value="301">301 Permanent</option>
                        <option value="302">302 Temporary</option>
                      </select>
                    </div>
                    <button class="btn btn-primary" type="submit">Add link</button>
                  </div>
                </form>
              </div>
            </div>
          `}
    </div>
  `;
}
