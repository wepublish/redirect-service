import { html } from "hono/html";
import type { StoredDomain } from "../db/domains-repo.ts";

export function renderLogin(devLoginEnabled: boolean, error?: string) {
  return html`
    <h2>Sign in</h2>
    ${error ? html`<p class="err">${error}</p>` : ""}
    <p><a href="/auth/github">Sign in with GitHub</a></p>
    ${devLoginEnabled
      ? html`<form method="post" action="/auth/dev-login">
          <h3>Dev login</h3>
          <label>User <input name="user" /></label>
          <label>Password <input name="password" type="password" /></label>
          <button type="submit">Log in</button>
        </form>`
      : ""}
  `;
}

export function renderDomainList(user: string, domains: StoredDomain[]) {
  return html`
    <p>Signed in as <strong>${user}</strong> · <a href="/logout">Log out</a></p>
    <h2>Domains</h2>
    <table>
      <thead><tr><th>Host</th><th>Mode</th><th>Target / rules</th><th></th></tr></thead>
      <tbody>
        ${domains.map(
          (d) => html`<tr>
            <td><a href="/admin/domains/${d.id}">${d.hostname}</a></td>
            <td>${d.mode}</td>
            <td>${d.mode === "domain" ? d.targetUrl : `${d.links.length} rule(s)`}</td>
            <td>
              <form class="inline" method="post" action="/admin/domains/${d.id}/delete"
                    onsubmit="return confirm('Delete ${d.hostname}?')">
                <button type="submit">Delete</button>
              </form>
            </td>
          </tr>`,
        )}
      </tbody>
    </table>

    <h3>Add a domain</h3>
    <form method="post" action="/admin/domains">
      <label>Hostname <input name="hostname" placeholder="old.example.com" required /></label>
      <label>Mode
        <select name="mode">
          <option value="domain">Whole-domain redirect</option>
          <option value="links">Exact link redirects</option>
        </select>
      </label>
      <fieldset>
        <legend>Whole-domain settings (used only for "Whole-domain" mode)</legend>
        <label>Target URL <input name="targetUrl" placeholder="https://new.example.com" /></label>
        <label><input type="checkbox" name="preservePath" checked /> Preserve path & query</label>
        <label>Type
          <select name="redirectType">
            <option value="301">301 Permanent</option>
            <option value="302">302 Temporary</option>
          </select>
        </label>
      </fieldset>
      <button type="submit">Add domain</button>
    </form>
  `;
}

export function renderDomainEdit(
  domain: StoredDomain,
  cname: { ok: boolean; detail: string },
  error?: string,
) {
  return html`
    <p><a href="/admin">← all domains</a></p>
    <h2>${domain.hostname}</h2>
    <p>CNAME: <span class="${cname.ok ? "ok" : "bad"}">${cname.detail}</span></p>
    ${error ? html`<p class="err">${error}</p>` : ""}
    ${domain.mode === "domain"
      ? html`<form method="post" action="/admin/domains/${domain.id}/update">
          <label>Target URL <input name="targetUrl" value="${domain.targetUrl ?? ""}" required /></label>
          <label><input type="checkbox" name="preservePath" ${domain.preservePath ? "checked" : ""} /> Preserve path & query</label>
          <label>Type
            <select name="redirectType">
              <option value="301" ${domain.redirectType === 301 ? "selected" : ""}>301 Permanent</option>
              <option value="302" ${domain.redirectType === 302 ? "selected" : ""}>302 Temporary</option>
            </select>
          </label>
          <button type="submit">Save</button>
        </form>`
      : html`
          <h3>Link redirects</h3>
          <table>
            <thead><tr><th>Source path</th><th>Target URL</th><th>Type</th><th></th></tr></thead>
            <tbody>
              ${domain.links.map(
                (l) => html`<tr>
                  <td>${l.sourcePath}</td>
                  <td>${l.targetUrl}</td>
                  <td>${l.redirectType}</td>
                  <td>
                    <form class="inline" method="post" action="/admin/links/${l.id}/delete">
                      <button type="submit">Delete</button>
                    </form>
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
          <h4>Add a link</h4>
          <form method="post" action="/admin/domains/${domain.id}/links">
            <label>Source path <input name="sourcePath" placeholder="/promo" required /></label>
            <label>Target URL <input name="targetUrl" placeholder="https://shop.com/sale" required /></label>
            <label>Type
              <select name="redirectType">
                <option value="301">301 Permanent</option>
                <option value="302">302 Temporary</option>
              </select>
            </label>
            <button type="submit">Add link</button>
          </form>
        `}
  `;
}
