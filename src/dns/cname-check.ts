import { Resolver } from "node:dns/promises";
import { normalizeHost } from "../validation.ts";

// c-ares codes that mean a definitive negative answer (record genuinely absent),
// as opposed to a transport/resolver failure we should retry elsewhere.
const NEGATIVE = new Set(["ENOTFOUND", "ENODATA"]);

// Build fresh resolvers for every check. A single long-lived c-ares Resolver can
// get stuck after a transient UDP failure on a long-running container and never
// recover until the process restarts — recreating per check avoids that.
// Prefer Cloudflare (1.1.1.1); fall back to the system resolver if it's
// unreachable, so a lookup never wrongly reads as "does not resolve".
function makeResolvers(): Resolver[] {
  const cloudflare = new Resolver({ timeout: 3000, tries: 2 });
  cloudflare.setServers(["1.1.1.1", "1.0.0.1"]);
  const system = new Resolver({ timeout: 3000, tries: 2 });
  return [cloudflare, system];
}

export type CnameState = "match" | "mismatch" | "unresolved" | "error";

export interface CnameStatus {
  /** true only when the host correctly points at the target. */
  ok: boolean;
  state: CnameState;
  detail: string;
}

class Unreachable extends Error {}

/**
 * Run a resolver op against Cloudflare, then the system resolver. Returns the
 * value on success, `null` for a definitive "no such record", and throws
 * `Unreachable` only if every resolver failed for transport reasons.
 */
async function lookup<T>(resolvers: Resolver[], op: (r: Resolver) => Promise<T>): Promise<T | null> {
  let transportFailed = false;
  for (const r of resolvers) {
    try {
      return await op(r);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code && NEGATIVE.has(code)) return null;
      transportFailed = true;
    }
  }
  if (transportFailed) throw new Unreachable();
  return null;
}

async function ips(resolvers: Resolver[], host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([
    lookup(resolvers, (r) => r.resolve4(host)),
    lookup(resolvers, (r) => r.resolve6(host)),
  ]);
  return [...(a ?? []), ...(aaaa ?? [])];
}

function mk(state: CnameState, detail: string): CnameStatus {
  return { state, ok: state === "match", detail };
}

/**
 * Checks whether `hostname` is pointed at `expectedTarget`. Passes when a CNAME
 * resolves to the target, or when the host resolves to the same IP(s) as the
 * target (covers apex CNAME-flattening / ALIAS / ANAME and plain A records).
 * Never throws.
 */
export async function checkCname(hostname: string, expectedTarget: string): Promise<CnameStatus> {
  const host = normalizeHost(hostname);
  const target = normalizeHost(expectedTarget);
  const resolvers = makeResolvers();
  try {
    const cnames = await lookup(resolvers, (r) => r.resolveCname(host));
    if (cnames && cnames.map(normalizeHost).includes(target)) {
      return mk("match", `CNAME → ${target}`);
    }

    const [hostIps, targetIps] = await Promise.all([ips(resolvers, host), ips(resolvers, target)]);
    if (hostIps.length === 0) {
      return mk("unresolved", `${host} does not resolve`);
    }
    const targetSet = new Set(targetIps);
    const shared = hostIps.filter((ip) => targetSet.has(ip));
    if (targetIps.length > 0 && shared.length > 0) {
      return mk("match", `Resolves to ${target} (${shared.join(", ")})`);
    }
    return mk(
      "mismatch",
      `Points to ${hostIps.join(", ")}, expected ${target}` +
        (targetIps.length ? ` (${targetIps.join(", ")})` : ""),
    );
  } catch (e) {
    if (e instanceof Unreachable) {
      return mk("error", "DNS lookup unavailable from the server");
    }
    return mk("error", `DNS check failed (${(e as { code?: string })?.code ?? "error"})`);
  }
}
