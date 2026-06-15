export type ValidationResult = { ok: true } | { ok: false; error: string };

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(":")[0]!;
}

export function validateTargetUrl(
  value: string,
  sourceHost?: string,
): ValidationResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Target must be an absolute URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Target must use http or https." };
  }
  if (sourceHost && normalizeHost(url.host) === normalizeHost(sourceHost)) {
    return { ok: false, error: "Target host equals source host (redirect loop)." };
  }
  return { ok: true };
}

export function validateSourcePath(value: string): ValidationResult {
  if (!value.startsWith("/")) {
    return { ok: false, error: "Path must start with '/'." };
  }
  return { ok: true };
}
