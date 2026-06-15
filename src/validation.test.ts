import { describe, expect, test } from "bun:test";
import { normalizeHost, validateTargetUrl, validateSourcePath } from "./validation.ts";

describe("normalizeHost", () => {
  test("lowercases and strips port", () => {
    expect(normalizeHost("Old.COM:443")).toBe("old.com");
  });
  test("trims whitespace", () => {
    expect(normalizeHost("  old.com  ")).toBe("old.com");
  });
});

describe("validateTargetUrl", () => {
  test("accepts absolute http(s) url", () => {
    expect(validateTargetUrl("https://new.com/x")).toEqual({ ok: true });
  });
  test("rejects relative url", () => {
    expect(validateTargetUrl("/foo").ok).toBe(false);
  });
  test("rejects non-http scheme", () => {
    expect(validateTargetUrl("ftp://x.com").ok).toBe(false);
  });
  test("flags self-redirect loop when source host equals target host", () => {
    const r = validateTargetUrl("https://old.com/x", "old.com");
    expect(r.ok).toBe(false);
  });
});

describe("validateSourcePath", () => {
  test("accepts a leading-slash path", () => {
    expect(validateSourcePath("/promo")).toEqual({ ok: true });
  });
  test("rejects path without leading slash", () => {
    expect(validateSourcePath("promo").ok).toBe(false);
  });
});
