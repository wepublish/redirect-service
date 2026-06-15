function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  adminHostname: required("ADMIN_HOSTNAME"),
  get cnameTarget(): string {
    return process.env.CNAME_TARGET || this.adminHostname;
  },
  acmeEmail: optional("ACME_EMAIL"),
  github: {
    clientId: optional("GITHUB_CLIENT_ID"),
    clientSecret: optional("GITHUB_CLIENT_SECRET"),
    callbackUrl: optional("GITHUB_OAUTH_CALLBACK_URL"),
    allowedOrg: optional("ALLOWED_GITHUB_ORG"),
    // Optional GitHub team slug. When set, sign-in requires membership of this
    // team within ALLOWED_GITHUB_ORG (stricter than org-wide membership).
    allowedTeam: optional("ALLOWED_GITHUB_TEAM"),
  },
  sessionSecret: required("SESSION_SECRET"),
  devLogin:
    process.env.DEV_ADMIN_USER && process.env.DEV_ADMIN_PASSWORD
      ? { user: process.env.DEV_ADMIN_USER, password: process.env.DEV_ADMIN_PASSWORD }
      : null,
  dataDir: optional("DATA_DIR", "./data"),
  port: Number(process.env.PORT ?? 3000),
  // Secure cookies require HTTPS. In production the app sits behind Caddy (TLS),
  // so default true; when a dev login is configured we assume local plain HTTP
  // and relax it so the session cookie is actually stored.
  get secureCookies(): boolean {
    if (process.env.COOKIE_SECURE === "true") return true;
    if (process.env.COOKIE_SECURE === "false") return false;
    return this.devLogin === null;
  },
} as const;

export type Config = typeof config;
