import { Database } from "bun:sqlite";

const ALLOWED_TYPES = "301,302,303,307,308";
const ALLOWED_MODES = "'domain','links','static'";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname      TEXT NOT NULL UNIQUE,
  mode          TEXT NOT NULL CHECK (mode IN (${ALLOWED_MODES})),
  target_url    TEXT,
  preserve_path INTEGER NOT NULL DEFAULT 1,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  html_content  TEXT,
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

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  const cols = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Rebuild a table when its SQL is missing any of the required `markers`. */
function rebuildIfOutdated(db: Database, table: string, markers: string[], rebuildSql: string): void {
  const row = db
    .query<{ sql: string }, [string]>(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  if (row && markers.some((m) => !row.sql.includes(m))) {
    db.run(rebuildSql);
  }
}

const DOMAINS_REBUILD = `
CREATE TABLE domains_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname      TEXT NOT NULL UNIQUE,
  mode          TEXT NOT NULL CHECK (mode IN (${ALLOWED_MODES})),
  target_url    TEXT,
  preserve_path INTEGER NOT NULL DEFAULT 1,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (${ALLOWED_TYPES})),
  project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  html_content  TEXT,
  created_at    TEXT NOT NULL
);
INSERT INTO domains_new (id, hostname, mode, target_url, preserve_path, redirect_type, project_id, html_content, created_at)
  SELECT id, hostname, mode, target_url, preserve_path, redirect_type, project_id, html_content, created_at FROM domains;
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
  // New columns must exist before any table rebuild copies them across.
  addColumnIfMissing(db, "domains", "project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "domains", "html_content", "TEXT");
  // Widen CHECK constraints: domains needs the 'static' mode + the 303/307/308
  // codes; link_redirects needs the wider codes. (Rebuild — FK is off here.)
  rebuildIfOutdated(db, "domains", ["'static'", "307"], DOMAINS_REBUILD);
  rebuildIfOutdated(db, "link_redirects", ["307"], LINKS_REBUILD);
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
