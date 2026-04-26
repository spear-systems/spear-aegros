/** Certificate Transparency names via crt.sh (public). Rate-limit friendly — single batch per apex. */

export interface CrtShName {
  readonly name_value: string;
}

export async function fetchCrtShSubdomains(
  apex: string,
  fetchImpl: typeof fetch,
): Promise<readonly string[]> {
  const q = `%.${apex}`;
  const url = `https://crt.sh/?q=${encodeURIComponent(q)}&output=json`;
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`crt.sh HTTP ${res.status}`);
  }
  const rows = (await res.json()) as CrtShName[];
  if (!Array.isArray(rows)) return [];
  const names = new Set<string>();
  for (const row of rows) {
    const raw = row.name_value?.split('\n') ?? [];
    for (const n of raw) {
      const s = n.trim().toLowerCase().replace(/^\*\./, '');
      if (s.endsWith(apex) || s === apex) names.add(s);
    }
  }
  return [...names].sort();
}
