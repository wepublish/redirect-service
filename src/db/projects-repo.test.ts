import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "./database.ts";
import { ProjectsRepo } from "./projects-repo.ts";
import { DomainsRepo } from "./domains-repo.ts";

let db: ReturnType<typeof openDatabase>;
let projects: ProjectsRepo;
let domains: DomainsRepo;

beforeEach(() => {
  db = openDatabase(":memory:");
  projects = new ProjectsRepo(db);
  domains = new DomainsRepo(db);
});

describe("ProjectsRepo", () => {
  test("create + list", () => {
    const p = projects.create("Marketing");
    expect(p.id).toBeGreaterThan(0);
    expect(projects.list().map((x) => x.name)).toEqual(["Marketing"]);
  });

  test("create is idempotent on duplicate name", () => {
    const a = projects.create("Dup");
    const b = projects.create("Dup");
    expect(a.id).toBe(b.id);
    expect(projects.list()).toHaveLength(1);
  });

  test("rename", () => {
    const p = projects.create("Old");
    projects.rename(p.id, "New");
    expect(projects.getById(p.id)?.name).toBe("New");
  });
});

describe("domain ↔ project", () => {
  test("createDomain stores projectId", () => {
    const p = projects.create("Campaign");
    const d = domains.createDomain({
      hostname: "old.com", mode: "domain", targetUrl: "https://new.com",
      preservePath: true, redirectType: 301, projectId: p.id,
    });
    expect(domains.getById(d.id)?.projectId).toBe(p.id);
  });

  test("defaults to null project", () => {
    const d = domains.createDomain({
      hostname: "old.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302,
    });
    expect(domains.getById(d.id)?.projectId).toBeNull();
  });

  test("setDomainProject moves a domain", () => {
    const p = projects.create("P");
    const d = domains.createDomain({
      hostname: "old.com", mode: "links", targetUrl: null, preservePath: false, redirectType: 302,
    });
    domains.setDomainProject(d.id, p.id);
    expect(domains.getById(d.id)?.projectId).toBe(p.id);
    domains.setDomainProject(d.id, null);
    expect(domains.getById(d.id)?.projectId).toBeNull();
  });

  test("deleting a project sets its domains' projectId to NULL (not deleted)", () => {
    const p = projects.create("Temp");
    const d = domains.createDomain({
      hostname: "old.com", mode: "domain", targetUrl: "https://new.com",
      preservePath: true, redirectType: 301, projectId: p.id,
    });
    projects.delete(p.id);
    const got = domains.getById(d.id);
    expect(got).not.toBeNull();
    expect(got?.projectId).toBeNull();
  });
});
