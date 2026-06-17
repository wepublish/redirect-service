import { Database } from "bun:sqlite";

const ALLOWED_TYPES = "301,302,303,307,308";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname      TEXT NOT NULL UNIQUE,
  mode          TEXT NOT NULL CHECK (mode IN ('domain','links')),
  target_url    TEXT,
  preserve_path INTEGER NOT NULL DEFAULT 1,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_redirects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_path   TEXT NOT NULL,
  target_url    TEXT NOT NULL,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  created_at    TEXT NOT NULL,
  UNIQUE (domain_id, source_path)
);
`;

/** Rebuild a table whose redirect_type CHECK predates the wider set of codes. */
function widenRedirectType(db: Database, table: string, rebuildSql: string): void {
  const row = db
    .query<{ sql: string }, [string]>(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  if (row && !row.sql.includes("307")) {
    db.run(rebuildSql);
  }
}

const DOMAINS_REBUILD = `
CREATE TABLE domains_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname      TEXT NOT NULL UNIQUE,
  mode          TEXT NOT NULL CHECK (mode IN ('domain','links')),
  target_url    TEXT,
  preserve_path INTEGER NOT NULL DEFAULT 1,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);
INSERT INTO domains_new (id, hostname, mode, target_url, preserve_path, redirect_type, project_id, created_at)
  SELECT id, hostname, mode, target_url, preserve_path, redirect_type, project_id, created_at FROM domains;
DROP TABLE domains;
ALTER TABLE domains_new RENAME TO domains;
`;

const LINKS_REBUILD = `
CREATE TABLE link_redirects_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_path   TEXT NOT NULL,
  target_url    TEXT NOT NULL,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  created_at    TEXT NOT NULL,
  UNIQUE (domain_id, source_path)
);
INSERT INTO link_redirects_new (id, domain_id, source_path, target_url, redirect_type, created_at)
  SELECT id, domain_id, source_path, target_url, redirect_type, created_at FROM link_redirects;
DROP TABLE link_redirects;
ALTER TABLE link_redirects_new RENAME TO link_redirects;
`;

/** Apply schema changes introduced after the initial release. Runs with FK off. */
function migrate(db: Database): void {
  // Add the projects relation column to pre-existing domains tables.
  const cols = db.query<{ name: string }, []>("PRAGMA table_info(domains)").all();
  if (!cols.some((c) => c.name === "project_id")) {
    db.run("ALTER TABLE domains ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL");
  }
  // Widen the redirect_type CHECK to include 303/307/308 (rebuild, FK is off here).
  widenRedirectType(db, "domains", DOMAINS_REBUILD);
  widenRedirectType(db, "link_redirects", LINKS_REBUILD);
}

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  // Keep foreign keys OFF during migration so table rebuilds can drop/rename.
  db.run("PRAGMA foreign_keys = OFF;");
  db.run(SCHEMA);
  migrate(db);
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}
