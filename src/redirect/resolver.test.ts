import { describe, expect, test } from "bun:test";
import { resolve, type DomainRecord } from "./resolver.ts";

const domainMode: DomainRecord = {
  hostname: "old.com",
  mode: "domain",
  targetUrl: "https://new.com",
  preservePath: true,
  redirectType: 301,
  links: [],
};

const linksMode: DomainRecord = {
  hostname: "promo.com",
  mode: "links",
  targetUrl: null,
  preservePath: false,
  redirectType: 302,
  links: [
    { sourcePath: "/promo", targetUrl: "https://shop.com/sale", redirectType: 302 },
    { sourcePath: "/old", targetUrl: "https://shop.com/new", redirectType: 301 },
  ],
};

describe("resolve", () => {
  test("unknown domain -> 404", () => {
    expect(resolve(null, "/x", "")).toEqual({ status: 404 });
  });

  test("domain mode preserves path and query by default", () => {
    expect(resolve(domainMode, "/foo", "?a=1")).toEqual({
      status: 301,
      location: "https://new.com/foo?a=1",
    });
  });

  test("domain mode without preserve goes to bare target", () => {
    const d = { ...domainMode, preservePath: false };
    expect(resolve(d, "/foo", "?a=1")).toEqual({
      status: 301,
      location: "https://new.com",
    });
  });

  test("domain mode root path with preserve does not append empty path", () => {
    expect(resolve(domainMode, "/", "")).toEqual({
      status: 301,
      location: "https://new.com/",
    });
  });

  test("links mode exact match returns rule target + type", () => {
    expect(resolve(linksMode, "/promo", "")).toEqual({
      status: 302,
      location: "https://shop.com/sale",
    });
    expect(resolve(linksMode, "/old", "")).toEqual({
      status: 301,
      location: "https://shop.com/new",
    });
  });

  test("links mode no match -> 404", () => {
    expect(resolve(linksMode, "/nope", "")).toEqual({ status: 404 });
  });
});
