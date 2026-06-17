// Standalone, self-contained 404 page served on redirect domains when no rule
// matches. Neutral/unbranded (it appears on customers' own hosts) with its own
// inline styles — it does not use the admin layout/navbar.
export function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>404 — Page not found</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(1200px 600px at 50% -10%, #1b2130 0%, #0e1116 60%);
      color: #e6e9ee;
      display: grid; place-items: center; text-align: center; padding: 2rem;
    }
    .code {
      font-size: clamp(72px, 18vw, 140px); font-weight: 800; line-height: 1;
      letter-spacing: -.04em;
      background: linear-gradient(180deg, #9aa4ff, #6a72f5);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    h1 { font-size: 20px; font-weight: 600; margin: 1rem 0 .35rem; }
    p { color: #9aa4b2; margin: 0; max-width: 30rem; }
  </style>
</head>
<body>
  <main>
    <div class="code">404</div>
    <h1>Page not found</h1>
    <p>The page you’re looking for doesn’t exist or has moved.</p>
  </main>
</body>
</html>`;
}
