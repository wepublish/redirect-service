import { Database } from "bun:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS domains (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname      TEXT NOT NULL UNIQUE,
  mode          TEXT NOT NULL CHECK (mode IN ('domain','links')),
  target_url    TEXT,
  preserve_path INTEGER NOT NULL DEFAULT 1,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (301,302)),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_redirects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id     INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_path   TEXT NOT NULL,
  target_url    TEXT NOT NULL,
  redirect_type INTEGER NOT NULL DEFAULT 301 CHECK (redirect_type IN (301,302)),
  created_at    TEXT NOT NULL,
  UNIQUE (domain_id, source_path)
);
`;

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");
  db.run(SCHEMA);
  return db;
}
