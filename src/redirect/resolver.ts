export type RedirectType = 301 | 302;

export interface LinkRule {
  sourcePath: string;
  targetUrl: string;
  redirectType: RedirectType;
}

export interface DomainRecord {
  hostname: string;
  mode: "domain" | "links";
  targetUrl: string | null;
  preservePath: boolean;
  redirectType: RedirectType;
  links: LinkRule[];
}

export type ResolveResult =
  | { status: RedirectType; location: string }
  | { status: 404 };

/**
 * Pure redirect resolution. `domain` is the matched DomainRecord (or null if the
 * host is not registered). `path` is the request path (always starts with "/"),
 * `query` is the raw query string including a leading "?" (or "").
 */
export function resolve(
  domain: DomainRecord | null,
  path: string,
  query: string,
): ResolveResult {
  if (!domain) return { status: 404 };

  if (domain.mode === "domain") {
    if (!domain.targetUrl) return { status: 404 };
    const location = domain.preservePath
      ? domain.targetUrl + path + query
      : domain.targetUrl;
    return { status: domain.redirectType, location };
  }

  // links mode: exact path match only
  const rule = domain.links.find((r) => r.sourcePath === path);
  if (!rule) return { status: 404 };
  return { status: rule.redirectType, location: rule.targetUrl };
}
