import { promises as dns } from "node:dns";
import { normalizeHost } from "../validation.ts";

export interface CnameStatus {
  ok: boolean;
  detail: string;
}

/**
 * Checks whether `hostname` is pointed at `expectedTarget` via CNAME, or whether
 * it otherwise resolves (some providers flatten CNAMEs at the apex). Best-effort,
 * informational only — never throws.
 */
export async function checkCname(hostname: string, expectedTarget: string): Promise<CnameStatus> {
  const host = normalizeHost(hostname);
  const target = normalizeHost(expectedTarget);
  try {
    const records = await dns.resolveCname(host);
    if (records.map(normalizeHost).includes(target)) {
      return { ok: true, detail: `CNAME → ${target}` };
    }
    return { ok: false, detail: `CNAME points to ${records.join(", ") || "nothing"}, expected ${target}` };
  } catch {
    // No CNAME record; fall back to checking A/AAAA resolution as a hint.
    try {
      await dns.lookup(host);
      return { ok: false, detail: `No CNAME to ${target} (host resolves, but not via CNAME)` };
    } catch {
      return { ok: false, detail: `${host} does not resolve` };
    }
  }
}
