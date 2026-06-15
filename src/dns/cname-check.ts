import { Resolver } from "node:dns/promises";
import { normalizeHost } from "../validation.ts";

// Resolve against Cloudflare's public DNS (1.1.1.1) rather than the container's
// resolver, so the CNAME check reflects authoritative public DNS.
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(["1.1.1.1", "1.0.0.1"]);

export interface CnameStatus {
  ok: boolean;
  detail: string;
}

/**
 * Checks whether `hostname` is pointed at `expectedTarget` via a CNAME record,
 * queried against 1.1.1.1. Best-effort and never throws.
 *
 * `ok: true` only when a CNAME for `hostname` resolves to `expectedTarget`.
 */
export async function checkCname(hostname: string, expectedTarget: string): Promise<CnameStatus> {
  const host = normalizeHost(hostname);
  const target = normalizeHost(expectedTarget);
  try {
    const records = await resolver.resolveCname(host);
    if (records.map(normalizeHost).includes(target)) {
      return { ok: true, detail: `CNAME → ${target}` };
    }
    return {
      ok: false,
      detail: `CNAME points to ${records.join(", ") || "nothing"}, expected ${target}`,
    };
  } catch {
    // No CNAME record; report whether it resolves at all for a clearer message.
    try {
      const addrs = await resolver.resolve4(host).catch(() => resolver.resolve6(host));
      return {
        ok: false,
        detail: `No CNAME to ${target} (resolves to ${addrs.join(", ")}, not via CNAME)`,
      };
    } catch {
      return { ok: false, detail: `${host} does not resolve` };
    }
  }
}
