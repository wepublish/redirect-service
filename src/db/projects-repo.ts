import type { Database } from "bun:sqlite";

export interface Project {
  id: number;
  name: string;
}

export class ProjectsRepo {
  constructor(private db: Database) {}

  /** Idempotent: returns the existing project if the name is already taken. */
  create(name: string): Project {
    const trimmed = name.trim();
    this.db
      .query<null, [string, string]>(
        `INSERT INTO projects (name, created_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`,
      )
      .run(trimmed, new Date().toISOString());
    return this.getByName(trimmed)!;
  }

  rename(id: number, name: string): void {
    this.db.query(`UPDATE projects SET name = ? WHERE id = ?`).run(name.trim(), id);
  }

  delete(id: number): void {
    // Domains keep existing; their project_id is set to NULL via the FK action.
    this.db.query(`DELETE FROM projects WHERE id = ?`).run(id);
  }

  list(): Project[] {
    return this.db.query<Project, []>(`SELECT id, name FROM projects ORDER BY name`).all();
  }

  getById(id: number): Project | null {
    return this.db.query<Project, [number]>(`SELECT id, name FROM projects WHERE id = ?`).get(id);
  }

  getByName(name: string): Project | null {
    return this.db
      .query<Project, [string]>(`SELECT id, name FROM projects WHERE name = ?`)
      .get(name.trim());
  }
}
