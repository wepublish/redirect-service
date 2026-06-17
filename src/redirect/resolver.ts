/** The supported HTTP redirect status codes, with human explanations. */
export const REDIRECT_TYPES = [
  {
    code: 301,
    label: "Moved Permanently",
    summary:
      "Permanent. Browsers and search engines cache it and update their links. Clients may switch the method to GET.",
    permanent: true,
  },
  {
    code: 302,
    label: "Found (temporary)",
    summary:
      "Temporary. Not cached long-term; the original URL keeps its ranking. Clients may switch the method to GET.",
    permanent: false,
  },
  {
    code: 303,
    label: "See Other",
    summary:
      "Temporary. Tells the client to fetch the target with GET — the classic redirect after a form POST.",
    permanent: false,
  },
  {
    code: 307,
    label: "Temporary Redirect",
    summary: "Temporary. The HTTP method and body are preserved (a POST stays a POST).",
    permanent: false,
  },
  {
    code: 308,
    label: "Permanent Redirect",
    summary: "Permanent, like 301, but the method and body are preserved (a POST stays a POST).",
    permanent: true,
  },
] as const;

export type RedirectType = (typeof REDIRECT_TYPES)[number]["code"];

const REDIRECT_CODES: readonly number[] = REDIRECT_TYPES.map((t) => t.code);

/** Coerce arbitrary form input to a valid redirect code, defaulting to 301. */
export function toRedirectType(value: unknown): RedirectType {
  const n = Number(value);
  return REDIRECT_CODES.includes(n) ? (n as RedirectType) : 301;
}

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
