import type { ScanPolicy } from '../scan-policy.js';

const COMMON = [
  'www',
  'mail',
  'api',
  'dev',
  'staging',
  'stage',
  'test',
  'vpn',
  'cdn',
  'app',
  'portal',
];

export function expandSubdomainsHeuristic(
  apex: string,
  passiveNames: readonly string[],
  policy: ScanPolicy,
): string[] {
  const set = new Set<string>([apex, ...passiveNames.map((s) => s.toLowerCase())]);
  if (policy === 'standard' || policy === 'aggressive') {
    for (const p of COMMON) {
      set.add(`${p}.${apex}`);
    }
  }
  return [...set].sort();
}
