import type { Database } from "bun:sqlite";
import type { DomainRecord, LinkRule, RedirectType } from "../redirect/resolver.ts";
import { normalizeHost } from "../validation.ts";

export interface CreateDomainInput {
  hostname: string;
  mode: "domain" | "links";
  targetUrl: string | null;
  preservePath: boolean;
  redirectType: RedirectType;
}

export interface StoredLink extends LinkRule {
  id: number;
}
export interface StoredDomain extends DomainRecord {
  id: number;
  links: StoredLink[];
}

interface DomainRow {
  id: number;
  hostname: string;
  mode: "domain" | "links";
  target_url: string | null;
  preserve_path: number;
  redirect_type: RedirectType;
}
interface LinkRow {
  id: number;
  source_path: string;
  target_url: string;
  redirect_type: RedirectType;
}

export class DomainsRepo {
  constructor(private db: Database) {}

  createDomain(input: CreateDomainInput): StoredDomain {
    const host = normalizeHost(input.hostname);
    const row = this.db
      .query<{ id: number }, [string, string, string | null, number, number, string]>(
        `INSERT INTO domains (hostname, mode, target_url, preserve_path, redirect_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(
        host,
        input.mode,
        input.targetUrl,
        input.preservePath ? 1 : 0,
        input.redirectType,
        new Date().toISOString(),
      )!;
    return {
      id: row.id,
      hostname: host,
      mode: input.mode,
      targetUrl: input.targetUrl,
      preservePath: input.preservePath,
      redirectType: input.redirectType,
      links: [],
    };
  }

  updateDomainTarget(
    id: number,
    targetUrl: string,
    preservePath: boolean,
    redirectType: RedirectType,
  ): void {
    this.db
      .query(
        `UPDATE domains SET target_url = ?, preserve_path = ?, redirect_type = ? WHERE id = ?`,
      )
      .run(targetUrl, preservePath ? 1 : 0, redirectType, id);
  }

  addLink(domainId: number, link: LinkRule): StoredLink {
    const row = this.db
      .query<{ id: number }, [number, string, string, number, string]>(
        `INSERT INTO link_redirects (domain_id, source_path, target_url, redirect_type, created_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(domainId, link.sourcePath, link.targetUrl, link.redirectType, new Date().toISOString())!;
    return { id: row.id, ...link };
  }

  deleteLink(linkId: number): void {
    this.db.query(`DELETE FROM link_redirects WHERE id = ?`).run(linkId);
  }

  deleteDomain(domainId: number): void {
    this.db.query(`DELETE FROM domains WHERE id = ?`).run(domainId);
  }

  getByHostname(hostname: string): StoredDomain | null {
    const host = normalizeHost(hostname);
    const row = this.db
      .query<DomainRow, [string]>(`SELECT * FROM domains WHERE hostname = ?`)
      .get(host);
    return row ? this.hydrate(row) : null;
  }

  getById(id: number): StoredDomain | null {
    const row = this.db.query<DomainRow, [number]>(`SELECT * FROM domains WHERE id = ?`).get(id);
    return row ? this.hydrate(row) : null;
  }

  listDomains(): StoredDomain[] {
    return this.db
      .query<DomainRow, []>(`SELECT * FROM domains ORDER BY hostname`)
      .all()
      .map((row) => this.hydrate(row));
  }

  isAllowedDomain(hostname: string): boolean {
    const host = normalizeHost(hostname);
    const row = this.db
      .query<{ n: number }, [string]>(`SELECT COUNT(*) AS n FROM domains WHERE hostname = ?`)
      .get(host)!;
    return row.n > 0;
  }

  private hydrate(row: DomainRow): StoredDomain {
    const links: StoredLink[] = this.db
      .query<LinkRow, [number]>(`SELECT * FROM link_redirects WHERE domain_id = ? ORDER BY id`)
      .all(row.id)
      .map((l) => ({
        id: l.id,
        sourcePath: l.source_path,
        targetUrl: l.target_url,
        redirectType: l.redirect_type,
      }));
    return {
      id: row.id,
      hostname: row.hostname,
      mode: row.mode,
      targetUrl: row.target_url,
      preservePath: row.preserve_path === 1,
      redirectType: row.redirect_type,
      links,
    };
  }
}
