/**
 * Normalize a single hostname: trim, lowercase ASCII, punycode for Unicode labels.
 * Does not validate TLD or perform DNS — callers enforce policy.
 */
export function normalizeDomainLabel(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  try {
    return new URL(`http://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^\.+|\.+$/g, '');
  }
}

/** Dedupe while preserving first-seen order. Filters empties after normalize. */
export function normalizeDomainsToScope(domains: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of domains) {
    const n = normalizeDomainLabel(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
