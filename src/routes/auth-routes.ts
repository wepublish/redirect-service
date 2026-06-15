import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { config } from "../config.ts";
import { buildAuthorizeUrl, exchangeCode, fetchLogin, isOrgMember, isTeamMember } from "../auth/github.ts";
import { setUser, clearUser, getUser } from "../auth/session.ts";
import { layout } from "../ui/layout.ts";
import { renderLogin } from "../ui/pages.ts";

const STATE_COOKIE = "rs_oauth_state";

export function authRoutes() {
  const app = new Hono();

  app.get("/login", async (c) => {
    if (await getUser(c)) return c.redirect("/admin");
    return c.html(layout("Sign in", renderLogin(config.devLogin !== null), { chrome: false }));
  });

  app.get("/auth/github", async (c) => {
    const state = crypto.randomUUID();
    await setSignedCookie(c, STATE_COOKIE, state, config.sessionSecret, {
      httpOnly: true, secure: config.secureCookies, sameSite: "Lax", path: "/", maxAge: 600,
    });
    return c.redirect(buildAuthorizeUrl(config.github.clientId, config.github.callbackUrl, state));
  });

  app.get("/auth/github/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const expected = await getSignedCookie(c, config.sessionSecret, STATE_COOKIE);
    if (!code || !state || state !== expected) {
      return c.html(layout("Sign in", renderLogin(config.devLogin !== null, "Invalid OAuth state."), { chrome: false }), 400);
    }
    const token = await exchangeCode(config.github.clientId, config.github.clientSecret, code);
    if (!token) return c.html(layout("Sign in", renderLogin(config.devLogin !== null, "OAuth exchange failed."), { chrome: false }), 400);
    const login = await fetchLogin(token);
    const { allowedOrg, allowedTeam } = config.github;
    const allowed =
      !!login &&
      (allowedTeam
        ? await isTeamMember(token, allowedOrg, allowedTeam)
        : await isOrgMember(token, allowedOrg, login));
    if (!login || !allowed) {
      const where = allowedTeam ? `the ${allowedOrg}/${allowedTeam} team` : `${allowedOrg}`;
      return c.html(layout("Sign in", renderLogin(config.devLogin !== null, `Not a member of ${where}.`), { chrome: false }), 403);
    }
    await setUser(c, login);
    return c.redirect("/admin");
  });

  app.post("/auth/dev-login", async (c) => {
    if (!config.devLogin) return c.notFound();
    const body = await c.req.parseBody();
    if (body.user === config.devLogin.user && body.password === config.devLogin.password) {
      await setUser(c, `dev:${config.devLogin.user}`);
      return c.redirect("/admin");
    }
    return c.html(layout("Sign in", renderLogin(true, "Invalid dev credentials."), { chrome: false }), 401);
  });

  app.get("/logout", (c) => {
    clearUser(c);
    return c.redirect("/login");
  });

  return app;
}
