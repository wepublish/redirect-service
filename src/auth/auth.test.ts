import { afterEach, describe, expect, test } from "bun:test";
import { isOrgMember } from "./github.ts";

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
