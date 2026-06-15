import { openDatabase } from "./db/database.ts";
import { DomainsRepo } from "./db/domains-repo.ts";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { mkdirSync } from "node:fs";

mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(`${config.dataDir}/redirects.db`);
const repo = new DomainsRepo(db);
const app = createApp(repo);

const server = Bun.serve({
  port: config.port,
  hostname: "127.0.0.1",
  fetch: app.fetch,
});

console.log(`redirect-service listening on http://127.0.0.1:${server.port}`);
