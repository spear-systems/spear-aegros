import dns from 'node:dns/promises';

export interface DnsIntelResult {
  readonly apex: string;
  readonly a: readonly string[];
  readonly aaaa: readonly string[];
  readonly mx: readonly { exchange: string; priority: number }[];
  readonly txt: readonly string[];
  readonly ns: readonly string[];
  readonly errors: readonly string[];
}

export async function collectDnsIntel(apex: string): Promise<DnsIntelResult> {
  const errors: string[] = [];

  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };

  const [a, aaaa, mx, txt, ns] = await Promise.all([
    safe('A', () => dns.resolve4(apex)),
    safe('AAAA', () => dns.resolve6(apex)),
    safe('MX', () => dns.resolveMx(apex)),
    safe('TXT', () => dns.resolveTxt(apex)),
    safe('NS', () => dns.resolveNs(apex)),
  ]);

  const flatTxt = (txt ?? []).map((chunks) => chunks.join(''));

  return {
    apex,
    a: a ?? [],
    aaaa: aaaa ?? [],
    mx: (mx ?? []).map((m) => ({ exchange: m.exchange, priority: m.priority })),
    txt: flatTxt,
    ns: ns ?? [],
    errors,
  };
}

export function summarizeEmailAuthSurface(txt: readonly string[]): {
  spf: boolean;
  dmarc: boolean;
  dkimHints: readonly string[];
} {
  const joined = txt.join('\n').toLowerCase();
  const dkimHints = txt.filter((r) => r.toLowerCase().includes('dkim'));
  return {
    spf: joined.includes('v=spf1'),
    dmarc: txt.some((r) => r.toLowerCase().startsWith('v=dmarc1')),
    dkimHints,
  };
}
