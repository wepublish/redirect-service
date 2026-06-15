import { afterEach, describe, expect, test } from "bun:test";
import { isOrgMember, isTeamMember } from "./github.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("isOrgMember", () => {
  test("returns true on 204 (member)", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    expect(await isOrgMember("token", "wepublish", "alice")).toBe(true);
  });

  test("returns false on 404 (not a member)", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    expect(await isOrgMember("token", "wepublish", "bob")).toBe(false);
  });

  test("returns false on other errors", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await isOrgMember("token", "wepublish", "carol")).toBe(false);
  });
});

describe("isTeamMember", () => {
  function withTeams(teams: unknown) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(teams), { status: 200 })) as unknown as typeof fetch;
  }

  test("true when the user is in the org/team (case-insensitive)", async () => {
    withTeams([{ slug: "Redirect-Admins", organization: { login: "WePublish" } }]);
    expect(await isTeamMember("token", "wepublish", "redirect-admins")).toBe(true);
  });

  test("false when team matches but org does not", async () => {
    withTeams([{ slug: "redirect-admins", organization: { login: "someone-else" } }]);
    expect(await isTeamMember("token", "wepublish", "redirect-admins")).toBe(false);
  });

  test("false when not in the team", async () => {
    withTeams([{ slug: "other-team", organization: { login: "wepublish" } }]);
    expect(await isTeamMember("token", "wepublish", "redirect-admins")).toBe(false);
  });

  test("false on API error", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
    expect(await isTeamMember("token", "wepublish", "redirect-admins")).toBe(false);
  });
});
