import type { TechSignal } from './tech-inference.js';
import type { Finding } from '../report-v2.js';

/** Lightweight, deterministic hints — not a replacement for authenticated scanning. */
export function correlateVulnsFromTech(signals: readonly TechSignal[]): Finding[] {
  const findings: Finding[] = [];
  for (const s of signals) {
    const p = s.product.toLowerCase();
    if (p.includes('nginx') && s.version) {
      findings.push({
        id: `tech-version-${s.product}-${s.version}`.replace(/\s+/g, '_'),
        title: `Technology version observed: ${s.product} ${s.version}`,
        severity: 'info',
        category: 'patch_management',
        description:
          'Version fingerprinting from HTTP headers can be inaccurate behind reverse proxies. Correlate with package managers or SBOM where possible.',
        remediation: 'Review vendor security advisories for the inferred stack and plan upgrades.',
        evidence: s.evidence,
        source: 'deterministic',
      });
    }
    if (p.includes('apache') && s.version) {
      findings.push({
        id: `tech-version-${s.product}-${s.version}`.replace(/\s+/g, '_'),
        title: `Technology version observed: ${s.product} ${s.version}`,
        severity: 'info',
        category: 'patch_management',
        description: 'Header-derived version; validate with authenticated inspection.',
        evidence: s.evidence,
        source: 'deterministic',
      });
    }
  }
  return dedupeFindings(findings);
}

function dedupeFindings(f: Finding[]): Finding[] {
  const m = new Map<string, Finding>();
  for (const x of f) m.set(x.id, x);
  return [...m.values()];
}
