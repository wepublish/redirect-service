import { Resolver } from "node:dns/promises";
import { normalizeHost } from "../validation.ts";

// Resolve against Cloudflare's public DNS (1.1.1.1) rather than the container's
// resolver, so the check reflects authoritative public DNS.
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(["1.1.1.1", "1.0.0.1"]);

export interface CnameStatus {
  ok: boolean;
  detail: string;
}

async function resolveIps(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([
    resolver.resolve4(host).catch(() => [] as string[]),
    resolver.resolve6(host).catch(() => [] as string[]),
  ]);
  return [...a, ...aaaa];
}

/**
 * Checks whether `hostname` is pointed at `expectedTarget`, queried via 1.1.1.1.
 * Best-effort and never throws. Two ways to pass:
 *   1. a CNAME record for `hostname` resolves to `expectedTarget`; or
 *   2. `hostname` resolves to the same IP(s) as `expectedTarget` — this covers
 *      apex/root domains using CNAME flattening / ALIAS / ANAME (which expose no
 *      CNAME record) and plain A-record setups.
 */
export async function checkCname(hostname: string, expectedTarget: string): Promise<CnameStatus> {
  const host = normalizeHost(hostname);
  const target = normalizeHost(expectedTarget);

  // 1) Direct CNAME match.
  try {
    const records = await resolver.resolveCname(host);
    if (records.map(normalizeHost).includes(target)) {
      return { ok: true, detail: `CNAME → ${target}` };
    }
  } catch {
    // No CNAME record (e.g. apex with flattening) — fall through to the IP check.
  }

  // 2) IP match: compare the host's addresses to the target's addresses.
  const [hostIps, targetIps] = await Promise.all([resolveIps(host), resolveIps(target)]);
  if (hostIps.length === 0) {
    return { ok: false, detail: `${host} does not resolve` };
  }
  const targetSet = new Set(targetIps);
  const shared = hostIps.filter((ip) => targetSet.has(ip));
  if (targetIps.length > 0 && shared.length > 0) {
    return { ok: true, detail: `Resolves to ${target} (${shared.join(", ")})` };
  }

  return {
    ok: false,
    detail:
      `Points to ${hostIps.join(", ")}, expected ${target}` +
      (targetIps.length ? ` (${targetIps.join(", ")})` : ""),
  };
}
