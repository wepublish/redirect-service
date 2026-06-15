import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export function layout(title: string, body: Html | string) {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — redirect-service</title>
    <script src="https://unpkg.com/htmx.org@2.0.3"></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 1rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: .5rem; text-align: left; }
      .ok { color: #137333; } .bad { color: #c5221f; }
      form.inline { display: inline; }
      .err { color: #c5221f; }
      fieldset { margin: 1rem 0; }
      label { display: block; margin: .4rem 0; }
    </style>
  </head>
  <body>
    <header><h1>redirect-service</h1></header>
    ${body}
  </body>
</html>`;
}
