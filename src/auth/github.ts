export interface GitHubUser {
  login: string;
  accessToken: string;
}

export function buildAuthorizeUrl(clientId: string, callbackUrl: string, state: string): string {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", callbackUrl);
  u.searchParams.set("scope", "read:org");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<string | null> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function fetchLogin(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "redirect-service" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { login?: string };
  return data.login ?? null;
}

/** Uses the org membership endpoint: 204 = member, anything else = not. */
export async function isOrgMember(
  accessToken: string,
  org: string,
  login: string,
): Promise<boolean> {
  const res = await fetch(`https://api.github.com/orgs/${org}/members/${login}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "redirect-service" },
  });
  return res.status === 204;
}

/**
 * Whether the authenticated user belongs to `teamSlug` within `org`. Checks the
 * user's own teams (`GET /user/teams`), which works with the `read:org` scope.
 */
export async function isTeamMember(
  accessToken: string,
  org: string,
  teamSlug: string,
): Promise<boolean> {
  const res = await fetch("https://api.github.com/user/teams?per_page=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "redirect-service",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return false;
  const teams = (await res.json()) as Array<{ slug?: string; organization?: { login?: string } }>;
  const o = org.toLowerCase();
  const t = teamSlug.toLowerCase();
  return teams.some(
    (team) => team.organization?.login?.toLowerCase() === o && team.slug?.toLowerCase() === t,
  );
}
