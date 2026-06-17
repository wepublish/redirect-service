import { X509Certificate } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { config } from "../config.ts";

export type CertState = "valid" | "soon" | "expired" | "none";

export interface CertStatus {
  state: CertState;
  /** Expiry date as YYYY-MM-DD, or null when there is no certificate yet. */
  validTo: string | null;
  daysLeft: number | null;
}

// Warn when a cert is within this many days of expiry (Caddy renews ~30 days
// out, so dropping below this usually means a renewal problem worth flagging).
const SOON_DAYS = 21;

/** Caddy's certificate storage: $XDG_DATA_HOME/caddy/certificates. */
function certDir(): string {
  const root = process.env.XDG_DATA_HOME ?? config.dataDir;
  return `${root}/caddy/certificates`;
}

function findCertFile(domain: string): string | null {
  const base = certDir();
  if (!existsSync(base)) return null;
  // certificates/<issuer>/<domain>/<domain>.crt — the issuer dir name varies
  // (prod vs staging ACME), so scan the issuer directories.
  for (const issuer of readdirSync(base)) {
    const file = `${base}/${issuer}/${domain}/${domain}.crt`;
    if (existsSync(file)) return file;
  }
  return null;
}

export function getCertStatus(domain: string): CertStatus {
  try {
    const file = findCertFile(domain);
    if (!file) return { state: "none", validTo: null, daysLeft: null };
    const cert = new X509Certificate(readFileSync(file));
    const validTo = cert.validToDate ?? new Date(cert.validTo);
    const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
    const state: CertState = daysLeft < 0 ? "expired" : daysLeft <= SOON_DAYS ? "soon" : "valid";
    return { state, validTo: validTo.toISOString().slice(0, 10), daysLeft };
  } catch {
    return { state: "none", validTo: null, daysLeft: null };
  }
}
