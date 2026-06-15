import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "./database.ts";
import { DomainsRepo } from "./domains-repo.ts";

function repo() {
  return new DomainsRepo(openDatabase(":memory:"));
}

describe("DomainsRepo", () => {
  let r: DomainsRepo;
  beforeEach(() => {
    r = repo();
  });

  test("create + get domain-mode record", () => {
    const d = r.createDomain({
      hostname: "old.com",
      mode: "domain",
      targetUrl: "https://new.com",
      preservePath: true,
      redirectType: 301,
    });
    const got = r.getByHostname("old.com");
    expect(got?.hostname).toBe("old.com");
    expect(got?.mode).toBe("domain");
    expect(got?.targetUrl).toBe("https://new.com");
    expect(got?.links).toEqual([]);
    expect(d.id).toBeGreaterThan(0);
  });

  test("getByHostname is case-insensitive via normalized storage", () => {
    r.createDomain({ hostname: "old.com", mode: "domain", targetUrl: "https://new.com", preservePath: true, redirectType: 301 });
    expect(r.getByHostname("OLD.COM")).not.toBeNull();
  });

  test("links mode: add + list link rules attached to record", () => {
    const d = r.createDomain({ hostname: "promo.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302 });
    r.addLink(d.id, { sourcePath: "/promo", targetUrl: "https://shop.com/sale", redirectType: 302 });
    const got = r.getByHostname("promo.com");
    expect(got?.links).toEqual([
      { id: expect.any(Number), sourcePath: "/promo", targetUrl: "https://shop.com/sale", redirectType: 302 },
    ]);
  });

  test("listDomains returns all", () => {
    r.createDomain({ hostname: "a.com", mode: "domain", targetUrl: "https://x.com", preservePath: true, redirectType: 301 });
    r.createDomain({ hostname: "b.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302 });
    expect(r.listDomains().map((d) => d.hostname).sort()).toEqual(["a.com", "b.com"]);
  });

  test("deleteDomain cascades link rules", () => {
    const d = r.createDomain({ hostname: "promo.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302 });
    r.addLink(d.id, { sourcePath: "/x", targetUrl: "https://y.com", redirectType: 301 });
    r.deleteDomain(d.id);
    expect(r.getByHostname("promo.com")).toBeNull();
    expect(r.listDomains()).toEqual([]);
  });

  test("deleteLink removes a single rule", () => {
    const d = r.createDomain({ hostname: "promo.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302 });
    const link = r.addLink(d.id, { sourcePath: "/x", targetUrl: "https://y.com", redirectType: 301 });
    r.deleteLink(link.id);
    expect(r.getByHostname("promo.com")?.links).toEqual([]);
  });

  test("isAllowedDomain true only for registered hosts", () => {
    r.createDomain({ hostname: "old.com", mode: "domain", targetUrl: "https://new.com", preservePath: true, redirectType: 301 });
    expect(r.isAllowedDomain("old.com")).toBe(true);
    expect(r.isAllowedDomain("nope.com")).toBe(false);
  });

  test("updateDomainTarget changes target/preserve/type", () => {
    const d = r.createDomain({ hostname: "old.com", mode: "domain", targetUrl: "https://a.com", preservePath: true, redirectType: 301 });
    r.updateDomainTarget(d.id, "https://b.com", false, 302);
    const got = r.getByHostname("old.com")!;
    expect(got.targetUrl).toBe("https://b.com");
    expect(got.preservePath).toBe(false);
    expect(got.redirectType).toBe(302);
  });
});
