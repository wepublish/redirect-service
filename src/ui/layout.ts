import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

const STYLES = `
  :root {
    color-scheme: dark;
    --bg: #0e1116;
    --surface: #161b22;
    --surface-2: #1c222b;
    --border: #2a313c;
    --border-strong: #3a434f;
    --text: #e6e9ee;
    --muted: #9aa4b2;
    --primary: #7c83ff;
    --primary-hover: #6a72f5;
    --primary-soft: rgba(124,131,255,.16);
    --danger: #f87171;
    --danger-soft: rgba(248,113,113,.14);
    --success: #4ade80;
    --success-soft: rgba(74,222,128,.14);
    --warn: #fbbf24;
    --warn-soft: rgba(251,191,36,.14);
    --links: #c4b5fd;
    --links-soft: rgba(167,139,250,.16);
    --radius: 10px;
    --radius-sm: 7px;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.25);
    --shadow-md: 0 6px 18px rgba(0,0,0,.4);
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text);
    background: var(--bg);
  }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1, h2, h3, h4 { margin: 0; font-weight: 600; letter-spacing: -.01em; }

  /* ---- top bar ---- */
  .navbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem;
    padding: .75rem 1.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: .6rem; font-weight: 600; font-size: 15px; color: var(--text); }
  .brand:hover { text-decoration: none; }
  .brand .mark {
    display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 8px;
    background: var(--primary); color: #fff;
  }
  .navbar .user { display: flex; align-items: center; gap: .75rem; color: var(--muted); font-size: 13px; }
  .avatar {
    display: grid; place-items: center;
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--primary-soft); color: var(--primary);
    font-weight: 600; font-size: 12px; text-transform: uppercase;
  }

  /* ---- layout ---- */
  .container { max-width: 880px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  .page-head { margin-bottom: 1.5rem; }
  .page-head h1 { font-size: 22px; }
  .page-head .sub { color: var(--muted); margin-top: .25rem; }
  .back { display: inline-flex; align-items: center; gap: .35rem; color: var(--muted); font-size: 13px; margin-bottom: 1rem; }
  .stack > * + * { margin-top: 1.25rem; }

  /* ---- card ---- */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .card-head { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
  .card-head h2, .card-head h3 { font-size: 15px; }
  .card-head .sub { color: var(--muted); font-size: 13px; margin-top: .15rem; }
  .card-body { padding: 1.25rem; }

  /* ---- table ---- */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase; color: var(--muted);
    padding: .65rem 1.25rem; border-bottom: 1px solid var(--border); background: var(--surface-2);
  }
  tbody td { padding: .85rem 1.25rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--surface-2); }
  td.actions { text-align: right; width: 1%; white-space: nowrap; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  .truncate { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ---- badges / pills ---- */
  .badge {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .15rem .55rem; border-radius: 999px;
    font-size: 12px; font-weight: 600; line-height: 1.4;
  }
  .badge-domain { background: var(--primary-soft); color: var(--primary); }
  .badge-links  { background: var(--links-soft); color: var(--links); }
  .badge-static { background: var(--success-soft); color: var(--success); }
  .badge-301 { background: var(--success-soft); color: var(--success); }
  .badge-302 { background: var(--warn-soft); color: var(--warn); }
  .pill { display: inline-flex; align-items: center; gap: .4rem; font-size: 13px; font-weight: 500; }
  .pill .dot { width: 8px; height: 8px; border-radius: 50%; }
  .pill.ok { color: var(--success); } .pill.ok .dot { background: var(--success); }
  .pill.bad { color: var(--danger); } .pill.bad .dot { background: var(--danger); }
  .pill.unknown { color: var(--warn); } .pill.unknown .dot { background: var(--warn); }
  .dot-only { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: middle; }
  .dot-only.ok { background: var(--success); } .dot-only.bad { background: var(--danger); }
  .dot-only.unknown { background: var(--warn); }

  /* ---- forms ---- */
  .field { display: block; margin-bottom: 1rem; }
  .field > .label { display: block; font-weight: 500; font-size: 13px; margin-bottom: .35rem; }
  .field .hint { color: var(--muted); font-size: 12px; margin-top: .3rem; }
  details.legend > summary { cursor: pointer; color: var(--primary); font-size: 13px; }
  details.legend ul { margin: .5rem 0 0; padding-left: 1.1rem; color: var(--muted); font-size: 13px; }
  details.legend li { margin: .25rem 0; }
  details.legend li strong { color: var(--text); }
  input[type=text], input:not([type]), input[type=password], select, textarea {
    width: 100%; padding: .55rem .7rem;
    border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    background: var(--bg); color: var(--text); font: inherit;
  }
  textarea { resize: vertical; min-height: 7rem; line-height: 1.45; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
  .check { display: flex; align-items: center; gap: .5rem; font-size: 14px; }
  .check input { width: auto; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
  @media (max-width: 560px) { .grid-2 { grid-template-columns: 1fr; } }
  .form-row { display: flex; gap: .6rem; align-items: flex-end; flex-wrap: wrap; }
  .form-row .field { flex: 1 1 160px; margin-bottom: 0; }

  /* ---- buttons ---- */
  .btn {
    display: inline-flex; align-items: center; gap: .4rem; justify-content: center;
    padding: .55rem .9rem; border-radius: var(--radius-sm);
    font: inherit; font-weight: 600; font-size: 13px; cursor: pointer;
    border: 1px solid transparent; background: var(--surface); color: var(--text);
  }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover { background: var(--primary-hover); }
  .btn-secondary { background: var(--surface); border-color: var(--border-strong); color: var(--text); }
  .btn-secondary:hover { background: var(--surface-2); }
  .btn-danger { background: var(--surface); border-color: var(--border-strong); color: var(--danger); }
  .btn-danger:hover { background: var(--danger-soft); border-color: var(--danger); }
  .btn-sm { padding: .35rem .6rem; font-size: 12px; }
  form.inline { display: inline; margin: 0; }

  /* ---- alert ---- */
  .alert { padding: .7rem .9rem; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 1rem; border: 1px solid; }
  .alert-error { background: var(--danger-soft); color: var(--danger); border-color: var(--danger); }

  /* ---- folder (collapsible project group) ---- */
  details.folder { padding: 0; }
  details.folder > summary {
    list-style: none; cursor: pointer; user-select: none;
    display: flex; align-items: center; gap: .6rem;
    padding: .85rem 1.25rem;
    font-weight: 600; font-size: 14px;
  }
  details.folder > summary::-webkit-details-marker { display: none; }
  details.folder > summary::before {
    content: "▸"; color: var(--muted); font-size: 11px; transition: transform .15s;
  }
  details.folder[open] > summary::before { transform: rotate(90deg); }
  details.folder[open] > summary { border-bottom: 1px solid var(--border); }
  details.folder > summary .folder-name { flex: 1; }
  details.folder .count {
    background: var(--surface-2); color: var(--muted);
    border-radius: 999px; padding: .1rem .5rem; font-size: 12px; font-weight: 600;
  }

  /* ---- empty state ---- */
  .empty { text-align: center; padding: 2.5rem 1rem; color: var(--muted); }
  .empty .icon { font-size: 26px; opacity: .5; }

  /* ---- login ---- */
  .login-wrap { min-height: calc(100vh - 58px); display: grid; place-items: center; padding: 1.5rem; }
  .login-card { width: 100%; max-width: 380px; }
  .login-card .card-body { padding: 1.75rem; }
  .login-title { text-align: center; margin-bottom: 1.25rem; }
  .login-title h1 { font-size: 19px; }
  .login-title .sub { color: var(--muted); font-size: 13px; margin-top: .25rem; }
  .btn-block { width: 100%; }
  .divider { display: flex; align-items: center; gap: .75rem; color: var(--muted); font-size: 12px; margin: 1.25rem 0; }
  .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--border); }
`;

const REDIRECT_MARK = html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline>
  <line x1="21" y1="3" x2="13" y2="11"></line><line x1="3" y1="21" x2="11" y2="13"></line></svg>`;

export interface LayoutOptions {
  user?: string;
  /** When false, the navbar shows only the brand (e.g. the login page). */
  chrome?: boolean;
}

export function layout(title: string, body: Html | string, opts: LayoutOptions = {}) {
  const { user, chrome = true } = opts;
  const initial = user ? user.replace(/^dev:/, "").slice(0, 2) : "";
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — redirect-service</title>
    <script src="https://unpkg.com/htmx.org@2.0.3"></script>
    <style>${raw(STYLES)}</style>
  </head>
  <body>
    <nav class="navbar">
      <a class="brand" href="${chrome ? "/admin" : "/login"}">
        <span class="mark">${REDIRECT_MARK}</span>
        redirect-service
      </a>
      ${chrome && user
        ? html`<div class="user">
            <span class="avatar">${initial}</span>
            <span>${user}</span>
            <a class="btn btn-secondary btn-sm" href="/logout">Log out</a>
          </div>`
        : ""}
    </nav>
    ${body}
  </body>
</html>`;
}
