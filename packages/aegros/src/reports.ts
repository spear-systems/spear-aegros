import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { ScanReport } from './scanner.js';

export interface ReportIndexEntry {
  readonly id: string;
  readonly path: string;
  readonly generatedAt: string;
  readonly domains: readonly string[];
  readonly findings: number;
}

export function getReportsIndexPath(): string {
  return join(homedir(), '.spear-aegros', 'reports', 'index.jsonl');
}

export async function appendReportIndex(entry: ReportIndexEntry): Promise<void> {
  const path = getReportsIndexPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function readReportIndexLines(): Promise<ReportIndexEntry[]> {
  const path = getReportsIndexPath();
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.map((line) => JSON.parse(line) as ReportIndexEntry);
  } catch {
    return [];
  }
}

export async function listReportsFromDisk(outputDir: string): Promise<ReportIndexEntry[]> {
  await mkdir(outputDir, { recursive: true });
  const names = await readdir(outputDir);
  const jsonFiles = names.filter((n) => n.startsWith('report-') && n.endsWith('.json'));
  const entries: ReportIndexEntry[] = [];
  for (const name of jsonFiles) {
    const full = join(outputDir, name);
    try {
      const raw = await readFile(full, 'utf8');
      const report = JSON.parse(raw) as ScanReport;
      if (
        report.id &&
        (report.schema === 'spear.aegros/cli-report@v2' ||
          report.schema === 'spear.aegros/cli-report@v1')
      ) {
        entries.push({
          id: report.id,
          path: full,
          generatedAt: report.generatedAt,
          domains: report.domains,
          findings: report.findings.length,
        });
      }
    } catch {
      // skip corrupt
    }
  }
  return entries.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
}

export async function mergeReportList(outputDir: string): Promise<ReportIndexEntry[]> {
  const fromIndex = await readReportIndexLines();
  const fromDisk = await listReportsFromDisk(outputDir);
  const byPath = new Map<string, ReportIndexEntry>();
  for (const e of fromDisk) byPath.set(resolve(e.path), e);
  for (const e of fromIndex) byPath.set(resolve(e.path), e);
  return [...byPath.values()].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
}

export async function resolveReportPath(
  idOrPath: string,
  outputDir: string,
): Promise<{ path: string; report: ScanReport } | null> {
  const trimmed = idOrPath.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.endsWith('.json')) {
    const abs = resolve(trimmed);
    try {
      const raw = await readFile(abs, 'utf8');
      return { path: abs, report: JSON.parse(raw) as ScanReport };
    } catch {
      return null;
    }
  }
  const merged = await mergeReportList(outputDir);
  const hit = merged.find((e) => e.id === trimmed || basename(e.path) === trimmed);
  if (!hit) return null;
  const raw = await readFile(hit.path, 'utf8');
  return { path: hit.path, report: JSON.parse(raw) as ScanReport };
}

export async function writeMarkdownSummary(report: ScanReport, mdPath: string): Promise<void> {
  const lines: string[] = [
    `# Spear Aegros report`,
    ``,
    `- **Report id:** \`${report.id}\``,
    `- **Generated:** ${report.generatedAt}`,
    `- **Policy:** ${report.policy}`,
    `- **Domains:** ${report.domains.join(', ')}`,
    `- **Risk score:** ${report.scoring.overallRisk ?? 'n/a'}`,
    ``,
    `## Findings (${String(report.findings.length)})`,
    ``,
  ];
  for (const f of report.findings) {
    lines.push(`### ${f.title}`, ``, `- **Severity:** ${f.severity}`, `- ${f.description}`);
    if (f.affectedAssets?.length) {
      lines.push(`- **Affected assets:** ${f.affectedAssets.join(', ')}`);
    }
    if (f.remediation) lines.push(`- **Remediation:** ${f.remediation}`);
    lines.push(``);
  }
  lines.push(`## Per-domain summary`, ``);
  for (const r of report.results) {
    lines.push(`### \`${r.domain}\``, ``);
    lines.push(`- **A:** ${r.dns.a.join(', ') || '—'}`);
    lines.push(`- **AAAA:** ${r.dns.aaaa.join(', ') || '—'}`);
    lines.push(`- **MX:** ${r.dns.mx.join(', ') || '—'}`);
    if (r.dns.provider) lines.push(`- **DNS/Email provider hint:** ${r.dns.provider}`);
    if (r.email) {
      lines.push(`- **Email score:** ${String(r.email.score)}/100 (${r.email.spoofingRisk} risk)`);
      lines.push(
        `- **Email controls:** SPF=${r.email.hasSpf ? 'yes' : 'no'}, DKIM=${r.email.hasDkim ? 'yes' : 'no'}, DMARC=${r.email.hasDmarc ? 'yes' : 'no'}, BIMI=${r.email.hasBimi ? 'yes' : 'no'}, MTA-STS=${r.email.hasMtaSts ? 'yes' : 'no'}, TLS-RPT=${r.email.hasTlsRpt ? 'yes' : 'no'}`,
      );
      if (r.email.dkimWeakSelectors.length) {
        lines.push(`- **Weak DKIM selectors:** ${r.email.dkimWeakSelectors.join(', ')}`);
      }
    }
    if (r.subdomains?.discovered.length) {
      lines.push(`- **Subdomains discovered:** ${String(r.subdomains.discovered.length)}`);
      lines.push(`- **Subdomain sample:** ${r.subdomains.discovered.slice(0, 12).join(', ')}`);
    }
    if (r.tls) {
      lines.push(
        `- **TLS:** protocol=${r.tls.protocol ?? '—'} cipher=${r.tls.cipher ?? '—'} issuer=${r.tls.issuer ?? '—'}`,
      );
      if (r.tls.validTo) lines.push(`- **Cert expiry:** ${r.tls.validTo}`);
      if (r.tls.san?.length)
        lines.push(`- **Cert SAN sample:** ${r.tls.san.slice(0, 8).join(', ')}`);
    }
    if (r.delivery) {
      lines.push(`- **CDN:** ${r.delivery.cdnProviders.join(', ') || '—'}`);
      lines.push(`- **WAF:** ${r.delivery.wafProviders.join(', ') || '—'}`);
    }
    if (r.hosting) {
      lines.push(
        `- **Hosting:** ${r.hosting.ip} ${r.hosting.asn ?? ''} ${r.hosting.asnName ?? ''} ${r.hosting.country ?? ''}`.trim(),
      );
    }
    if (r.ports) {
      lines.push(`- **Open ports (aggressive):** ${r.ports.open.join(', ') || 'none'}`);
    }
    if (r.domainIntel) {
      lines.push(`- **Domain status:** ${r.domainIntel.statuses.join(', ') || '—'}`);
      if (r.domainIntel.expiresAt) lines.push(`- **Domain expiry:** ${r.domainIntel.expiresAt}`);
    }
    if (r.storageExposure?.length) {
      const notable = r.storageExposure
        .filter((entry) => entry.status === 200 || entry.status === 403)
        .slice(0, 8);
      if (notable.length) {
        lines.push(
          `- **Storage exposure sample:** ${notable.map((entry) => `${entry.provider}:${entry.variant}(${entry.status})`).join(', ')}`,
        );
      }
    }
    if (r.typosquatting?.variants.length) {
      lines.push(
        `- **Typosquatting variants:** ${r.typosquatting.variants.slice(0, 10).join(', ')}`,
      );
    }
    if (r.fingerprint) {
      lines.push(
        `- **Fingerprint:** ${r.fingerprint.finalUrl} (HTTP ${String(r.fingerprint.status ?? '—')})`,
      );
      if (r.fingerprint.server) lines.push(`- **Server:** ${r.fingerprint.server}`);
      if (r.fingerprint.poweredBy) lines.push(`- **X-Powered-By:** ${r.fingerprint.poweredBy}`);
      if (r.fingerprint.detectedStack.length)
        lines.push(`- **Stack hints:** ${r.fingerprint.detectedStack.join(', ')}`);
      const sh = r.fingerprint.securityHeaders;
      const present = Object.entries(sh).filter(([, v]) => Boolean(v));
      if (present.length) {
        lines.push(`- **Security headers:** ${present.map(([k]) => k).join(', ')}`);
      }
    }
    lines.push(``);
  }
  lines.push(`---`, `Generated by Spear Aegros CLI.`, ``);
  await mkdir(dirname(mdPath), { recursive: true });
  await writeFile(mdPath, lines.join('\n'), 'utf8');
}
