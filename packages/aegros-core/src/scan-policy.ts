/** Scan aggressiveness — maps to engine behavior and legal posture hints. */
export type ScanPolicy = 'passive' | 'standard' | 'aggressive';

export const DEFAULT_SCAN_POLICY: ScanPolicy = 'passive';

export function parseScanPolicy(raw: string | undefined): ScanPolicy {
  if (raw === 'standard' || raw === 'aggressive') return raw;
  return 'passive';
}
