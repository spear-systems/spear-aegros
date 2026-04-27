import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ScanPolicy } from './config.js';
import { collectDnsEmailDomainIntel, detectEmailProvider } from './scanner-dns-email.js';
import {
  aggressivePortProbe,
  collectTlsSnapshot,
  detectCdnWaf,
  discoverSubdomains,
  enrichHosting,
  findingsForBucketExposure,
  findingsForTls,
  generateTyposquatCandidates,
  collectDomainLifecycle,
  probeBucketExposure,
  scanTakeoverCandidates,
} from './scanner-intel.js';
export { detectEmailProvider };

export interface ScanInput {
  readonly domains: readonly string[];
  readonly policy: ScanPolicy;
  readonly outputPath: string;
  readonly timeoutMs: number;
  readonly maxDomains: number;
  readonly integrationKeys?: Partial<Record<OptionalIntegrationId, string>>;
}

export interface Finding {
  readonly id: string;
  readonly severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly remediation?: string;
  readonly affectedAssets?: readonly string[];
}

export type ScanStage = 'normalize' | 'dns' | 'fingerprint' | 'http' | 'security' | 'report';

export type ScanProgressEvent =
  | { readonly kind: 'stage'; readonly stage: ScanStage; readonly message: string }
  | {
      readonly kind: 'log';
      readonly level: 'debug' | 'info' | 'warn';
      readonly message: string;
      readonly context?: string;
    };

export type ScanProgressHandler = (event: ScanProgressEvent) => void;

export interface HttpFingerprint {
  readonly method: 'HEAD' | 'GET';
  readonly finalUrl: string;
  readonly status?: number;
  readonly server?: string;
  readonly poweredBy?: string;
  readonly securityHeaders: Readonly<Record<string, string | undefined>>;
  readonly detectedStack: readonly string[];
}

export interface ProbeResult {
  readonly status?: number;
  readonly url: string;
  readonly finalUrl: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly fingerprint?: HttpFingerprint;
}

export interface DomainResult {
  domain: string;
  dns: {
    a: readonly string[];
    aaaa: readonly string[];
    mx: readonly string[];
    txt: readonly string[];
    ns?: readonly string[];
    soa?: {
      readonly nsname: string;
      readonly hostmaster: string;
      readonly serial: number;
      readonly refresh: number;
      readonly retry: number;
      readonly expire: number;
      readonly minttl: number;
    };
    caa?: readonly string[];
    cname?: readonly string[];
    srv?: readonly string[];
    ptr?: readonly string[];
    dnssec?: {
      readonly dsPresent: boolean;
      readonly dnskeyPresent: boolean;
    };
    tlsa?: readonly string[];
    provider?: string;
    axfr?: {
      readonly attempted: boolean;
      readonly success: boolean;
      readonly note?: string;
    };
  };
  email?: {
    readonly provider?: string;
    readonly hasSpf: boolean;
    readonly hasDkim: boolean;
    readonly hasDmarc: boolean;
    readonly hasBimi: boolean;
    readonly hasMtaSts: boolean;
    readonly hasTlsRpt: boolean;
    readonly spfLookupDepth: number;
    readonly dkimWeakSelectors: readonly string[];
    readonly splitDelivery: boolean;
    readonly spoofingRisk: 'low' | 'medium' | 'high';
    readonly score: number;
  };
  http: {
    https?: ProbeResult;
    http?: ProbeResult;
  };
  fingerprint?: HttpFingerprint;
  tls?: {
    readonly protocol?: string;
    readonly cipher?: string;
    readonly issuer?: string;
    readonly validFrom?: string;
    readonly validTo?: string;
    readonly san?: readonly string[];
    readonly selfSigned?: boolean;
    readonly signatureAlgorithm?: string;
  };
  delivery?: {
    readonly cdnProviders: readonly string[];
    readonly wafProviders: readonly string[];
  };
  hosting?: {
    readonly ip: string;
    readonly asn?: string;
    readonly asnName?: string;
    readonly prefix?: string;
    readonly country?: string;
  };
  subdomains?: {
    readonly discovered: readonly string[];
    readonly sources: Readonly<Record<string, readonly string[]>>;
  };
  ports?: {
    readonly open: readonly number[];
  };
  domainIntel?: {
    readonly registrar?: string;
    readonly createdAt?: string;
    readonly updatedAt?: string;
    readonly expiresAt?: string;
    readonly statuses: readonly string[];
    readonly nameservers: readonly string[];
  };
  storageExposure?: readonly {
    readonly provider: 's3' | 'gcs';
    readonly variant: string;
    readonly status: number;
    readonly url: string;
  }[];
  typosquatting?: {
    readonly variants: readonly string[];
  };
}

export interface ScanReport {
  readonly schema: 'spear.aegros/cli-report@v2';
  readonly id: string;
  readonly generatedAt: string;
  readonly policy: ScanPolicy;
  readonly domains: readonly string[];
  readonly findings: readonly Finding[];
  readonly results: readonly DomainResult[];
  readonly summary: {
    readonly findingsBySeverity: Readonly<Record<Finding['severity'], number>>;
    readonly totalDomains: number;
    readonly totalFindings: number;
  };
  readonly scoring: {
    readonly overallRisk: number | null;
    readonly method: 'reserved';
  };
  readonly infrastructureMap: {
    readonly nodes: readonly string[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
      readonly relation: string;
    }[];
  };
  readonly integrations: {
    readonly available: readonly OptionalIntegrationId[];
    readonly skipped: readonly IntegrationSkip[];
  };
}

export type PolicyRequirement = 'passive' | 'standard' | 'aggressive';

export type OptionalIntegrationId = 'virustotal' | 'alienvault-otx' | 'abuseipdb' | 'safebrowsing';

export interface IntegrationSkip {
  readonly integration: OptionalIntegrationId;
  readonly reason: 'missing_key' | 'disabled';
  readonly message: string;
}

interface ScanState {
  readonly input: ScanInput;
  readonly domains: string[];
  readonly findings: Finding[];
  readonly results: DomainResult[];
  readonly integrationSkips: IntegrationSkip[];
}

interface Collector {
  readonly name: string;
  readonly stage: ScanStage;
  readonly run: (state: ScanState, onProgress?: ScanProgressHandler) => Promise<void>;
}

function pickSecurityHeaders(h: Headers): Record<string, string | undefined> {
  const keys = [
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'cross-origin-opener-policy',
  ] as const;
  const out: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function inferStack(server: string | null, poweredBy: string | null, h: Headers): string[] {
  const hints = new Set<string>();
  const s = (server ?? '').toLowerCase();
  const p = (poweredBy ?? '').toLowerCase();
  if (s.includes('nginx')) hints.add('nginx');
  if (s.includes('apache')) hints.add('apache');
  if (s.includes('cloudflare') || h.has('cf-ray')) hints.add('cloudflare');
  if (s.includes('vercel') || h.has('x-vercel-id')) hints.add('vercel');
  if (s.includes('github')) hints.add('github-pages');
  if (s.includes('awselb') || s.includes('amazon')) hints.add('aws');
  if (s.includes('microsoft-iis')) hints.add('iis');
  if (p.includes('express')) hints.add('express');
  if (p.includes('php')) hints.add('php');
  if (p.includes('asp.net')) hints.add('aspnet');
  const via = h.get('via')?.toLowerCase() ?? '';
  if (via.includes('varnish')) hints.add('varnish');
  return [...hints];
}

function buildFingerprint(method: 'HEAD' | 'GET', res: Response): HttpFingerprint {
  const server = res.headers.get('server') ?? undefined;
  const poweredBy = res.headers.get('x-powered-by') ?? undefined;
  const securityHeaders = pickSecurityHeaders(res.headers);
  const detectedStack = inferStack(server ?? null, poweredBy ?? null, res.headers);
  return {
    method,
    finalUrl: res.url,
    status: res.status,
    server,
    poweredBy,
    securityHeaders,
    detectedStack,
  };
}

export async function loadDomainsFromFile(path: string): Promise<string[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line && !line.startsWith('#')));
}

function normalizeDomainLabel(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    return new URL(`http://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^\.+|\.+$/g, '');
  }
}

function normalizeDomains(input: readonly string[], maxDomains: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const normalized = normalizeDomainLabel(raw);
    if (!normalized || seen.has(normalized)) continue;
    out.push(normalized);
    seen.add(normalized);
    if (out.length >= maxDomains) break;
  }
  return out;
}

async function probeHttp(
  url: string,
  timeoutMs: number,
  method: 'HEAD' | 'GET',
  onLog?: ScanProgressHandler,
): Promise<ProbeResult> {
  const short = `${method} ${url}`;
  onLog?.({ kind: 'log', level: 'debug', message: short, context: 'http' });
  try {
    const res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: { 'user-agent': 'spear-aegros/cli (security assessment)' },
    });
    const fingerprint = buildFingerprint(method, res);
    onLog?.({
      kind: 'log',
      level: 'info',
      message:
        `${short} → ${String(res.status)} ${res.url !== url ? `final=${res.url}` : ''}`.trim(),
      context: 'http',
    });
    if (fingerprint.server) {
      onLog?.({
        kind: 'log',
        level: 'debug',
        message: `Server: ${fingerprint.server}`,
        context: 'fingerprint',
      });
    }
    if (fingerprint.detectedStack.length) {
      onLog?.({
        kind: 'log',
        level: 'info',
        message: `Stack hints: ${fingerprint.detectedStack.join(', ')}`,
        context: 'fingerprint',
      });
    }
    return {
      status: res.status,
      url,
      finalUrl: res.url,
      ok: res.ok,
      fingerprint,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    onLog?.({ kind: 'log', level: 'warn', message: `${short} failed: ${msg}`, context: 'http' });
    return {
      url,
      finalUrl: url,
      ok: false,
      error: msg,
    };
  }
}

export function policyAllows(policy: ScanPolicy, requirement: PolicyRequirement): boolean {
  if (requirement === 'passive') return true;
  if (requirement === 'standard') return policy === 'standard' || policy === 'aggressive';
  return policy === 'aggressive';
}

function summarizeFindings(findings: readonly Finding[]): Record<Finding['severity'], number> {
  return findings.reduce<Record<Finding['severity'], number>>(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
  );
}

function dedupeFindings(findings: readonly Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    const key = [
      finding.severity,
      finding.title.trim().toLowerCase(),
      finding.description.trim().toLowerCase(),
      finding.remediation?.trim().toLowerCase() ?? '',
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, finding);
      continue;
    }
    const mergedAssets = new Set<string>([
      ...(existing.affectedAssets ?? []),
      ...(finding.affectedAssets ?? []),
    ]);
    byKey.set(key, {
      ...existing,
      affectedAssets: mergedAssets.size ? [...mergedAssets].sort() : undefined,
    });
  }
  return [...byKey.values()];
}

function computeRiskScore(findings: readonly Finding[]): number {
  const weight: Record<Finding['severity'], number> = {
    critical: 25,
    high: 15,
    medium: 5,
    low: 2,
    info: 0,
  };
  return findings.reduce((score, finding) => score + weight[finding.severity], 0);
}

function buildInfrastructureMap(results: readonly DomainResult[]): ScanReport['infrastructureMap'] {
  const nodes = new Set<string>();
  const edges: { from: string; to: string; relation: string }[] = [];
  for (const result of results) {
    nodes.add(result.domain);
    for (const ip of result.dns.a) {
      nodes.add(ip);
      edges.push({ from: result.domain, to: ip, relation: 'resolves_to' });
    }
    if (result.hosting?.asn) {
      nodes.add(result.hosting.asn);
      edges.push({ from: result.domain, to: result.hosting.asn, relation: 'hosted_by_asn' });
    }
    for (const mx of result.dns.mx) {
      nodes.add(mx);
      edges.push({ from: result.domain, to: mx, relation: 'mx' });
    }
    for (const provider of result.delivery?.cdnProviders ?? []) {
      nodes.add(provider);
      edges.push({ from: result.domain, to: provider, relation: 'cdn' });
    }
  }
  return {
    nodes: [...nodes].sort(),
    edges,
  };
}

function classifyAvailableIntegrations(
  integrationKeys: ScanInput['integrationKeys'],
): OptionalIntegrationId[] {
  if (!integrationKeys) return [];
  const all: OptionalIntegrationId[] = [
    'virustotal',
    'alienvault-otx',
    'abuseipdb',
    'safebrowsing',
  ];
  return all.filter((integration) => Boolean(integrationKeys[integration]?.trim()));
}

function createCollectors(
  log: (level: 'debug' | 'info' | 'warn', message: string, context?: string) => void,
) {
  const dnsCollector: Collector = {
    name: 'dns-baseline',
    stage: 'dns',
    run: async (state) => {
      for (const domain of state.domains) {
        const intel = await collectDnsEmailDomainIntel(domain, state.input.policy, log);
        state.findings.push(...intel.findings);
        state.results.push({
          domain,
          dns: intel.dns,
          email: intel.email,
          http: {},
        });
      }
    },
  };

  const httpCollector: Collector = {
    name: 'http-fingerprint',
    stage: 'fingerprint',
    run: async (state, onProgress) => {
      for (const entry of state.results) {
        const domain = entry.domain;
        if (!policyAllows(state.input.policy, 'standard')) {
          const https = await probeHttp(
            `https://${domain}/`,
            state.input.timeoutMs,
            'HEAD',
            onProgress,
          );
          entry.http.https = https;
          entry.fingerprint = https.fingerprint;
          state.findings.push(
            ...securityFindingsForFingerprint(domain, https.fingerprint, 'https'),
          );
          if (!https.ok && https.error) {
            state.findings.push({
              id: randomUUID(),
              severity: 'info',
              title: `HTTPS HEAD failed for ${domain}`,
              description: https.error,
            });
          }
          continue;
        }

        const https = await probeHttp(
          `https://${domain}/`,
          state.input.timeoutMs,
          'GET',
          onProgress,
        );
        entry.http.https = https;
        entry.fingerprint = https.fingerprint;
        state.findings.push(...securityFindingsForFingerprint(domain, https.fingerprint, 'https'));
        if (!https.ok && https.error) {
          state.findings.push({
            id: randomUUID(),
            severity: 'info',
            title: `HTTPS GET failed for ${domain}`,
            description: https.error,
          });
        }
        if ((https.status ?? 0) >= 500) {
          state.findings.push({
            id: randomUUID(),
            severity: 'low',
            title: `Server error on ${https.finalUrl}`,
            description: `HTTP ${String(https.status)}`,
          });
        }

        const httpProbe = await probeHttp(
          `http://${domain}/`,
          state.input.timeoutMs,
          'GET',
          onProgress,
        );
        entry.http.http = httpProbe;
        state.findings.push(
          ...securityFindingsForFingerprint(domain, httpProbe.fingerprint, 'http'),
        );
        if (!httpProbe.ok && httpProbe.error) {
          state.findings.push({
            id: randomUUID(),
            severity: 'info',
            title: `HTTP GET failed for ${domain}`,
            description: httpProbe.error,
          });
        }

        if (policyAllows(state.input.policy, 'aggressive') && !domain.startsWith('www.')) {
          const www = await probeHttp(
            `https://www.${domain}/`,
            state.input.timeoutMs,
            'GET',
            onProgress,
          );
          log(
            'info',
            `Aggressive: www.${domain} → ${String(www.status ?? 'n/a')} ${www.ok ? 'ok' : (www.error ?? 'fail')}`,
            'http',
          );
        }
      }
    },
  };

  const integrationCollector: Collector = {
    name: 'integration-availability',
    stage: 'security',
    run: (state) => {
      const optionalIntegrations: OptionalIntegrationId[] = [
        'virustotal',
        'alienvault-otx',
        'abuseipdb',
        'safebrowsing',
      ];
      for (const integration of optionalIntegrations) {
        if (state.input.integrationKeys?.[integration]?.trim()) continue;
        const skip: IntegrationSkip = {
          integration,
          reason: 'missing_key',
          message: `Skipped ${integration}: API key unavailable.`,
        };
        state.integrationSkips.push(skip);
        log('info', skip.message, 'integrations');
      }
      return Promise.resolve();
    },
  };

  const intelCollector: Collector = {
    name: 'internet-intel',
    stage: 'security',
    run: async (state) => {
      for (const entry of state.results) {
        const subdomainIntel = await discoverSubdomains(
          entry.domain,
          state.input.policy,
          state.input.timeoutMs,
          log,
        );
        entry.subdomains = {
          discovered: subdomainIntel.subdomains,
          sources: subdomainIntel.sourceMap,
        };
        state.findings.push(...subdomainIntel.findings);
        state.findings.push(
          ...(await scanTakeoverCandidates(
            entry.domain,
            subdomainIntel.subdomains,
            state.input.timeoutMs,
          )),
        );

        if (policyAllows(state.input.policy, 'standard')) {
          entry.tls = await collectTlsSnapshot(entry.domain, state.input.timeoutMs);
          state.findings.push(...findingsForTls(entry.domain, entry.tls));
          entry.delivery = await detectCdnWaf(entry.domain, state.input.timeoutMs);
        }

        const primaryIp = entry.dns.a[0];
        if (primaryIp) {
          entry.hosting = await enrichHosting(primaryIp, state.input.timeoutMs);
          if (policyAllows(state.input.policy, 'aggressive')) {
            entry.ports = { open: await aggressivePortProbe(primaryIp, 3000) };
            if (entry.ports.open.includes(23)) {
              state.findings.push({
                id: randomUUID(),
                severity: 'critical',
                title: `Telnet exposed on ${entry.domain}`,
                description: `Port 23 is open on ${primaryIp}.`,
                remediation: 'Disable Telnet and use SSH with strong authentication controls.',
                affectedAssets: [entry.domain, primaryIp],
              });
            }
          }
        }

        entry.domainIntel = await collectDomainLifecycle(entry.domain, state.input.timeoutMs);
        if (
          entry.domainIntel?.statuses.some((status) =>
            status.toLowerCase().includes('pending delete'),
          )
        ) {
          state.findings.push({
            id: randomUUID(),
            severity: 'high',
            title: `Domain lifecycle risk for ${entry.domain}`,
            description: 'WHOIS/RDAP status includes pending delete.',
            remediation: 'Confirm domain renewal and registrar status immediately.',
            affectedAssets: [entry.domain],
          });
        }

        entry.storageExposure = await probeBucketExposure(entry.domain, state.input.timeoutMs);
        state.findings.push(...findingsForBucketExposure(entry.domain, entry.storageExposure));

        const typos = generateTyposquatCandidates(entry.domain, state.input.policy);
        if (typos.length > 0) {
          entry.typosquatting = { variants: typos };
          state.findings.push({
            id: randomUUID(),
            severity: 'info',
            title: `Typosquatting watchlist generated for ${entry.domain}`,
            description: `Generated ${String(typos.length)} aggressive typo candidates for monitoring.`,
            affectedAssets: [entry.domain, ...typos.slice(0, 10)],
          });
        }
      }
    },
  };

  return [dnsCollector, httpCollector, integrationCollector, intelCollector] as const;
}

function securityFindingsForFingerprint(
  domain: string,
  fp: HttpFingerprint | undefined,
  scheme: 'https' | 'http',
): Finding[] {
  const out: Finding[] = [];
  if (!fp || fp.status === undefined || fp.status >= 400) return out;
  if (scheme === 'https' && fp.status < 400) {
    if (!fp.securityHeaders['strict-transport-security']) {
      out.push({
        id: randomUUID(),
        severity: 'medium',
        title: `Missing HSTS on ${domain}`,
        description: 'HTTPS responded without a Strict-Transport-Security header.',
        remediation: 'Publish HSTS with an appropriate max-age and includeSubDomains as needed.',
      });
    }
    if (!fp.securityHeaders['content-security-policy']) {
      out.push({
        id: randomUUID(),
        severity: 'low',
        title: `No Content-Security-Policy on ${domain}`,
        description: 'Consider CSP to reduce XSS impact.',
        remediation: 'Deploy a strict CSP appropriate to your app.',
      });
    }
    if (!fp.securityHeaders['x-frame-options'] && !fp.securityHeaders['content-security-policy']) {
      out.push({
        id: randomUUID(),
        severity: 'low',
        title: `Clickjacking risk on ${domain}`,
        description: 'Neither X-Frame-Options nor frame-ancestors in CSP was observed.',
        remediation: 'Set frame-ancestors in CSP or X-Frame-Options.',
      });
    }
  }
  if (fp.poweredBy) {
    out.push({
      id: randomUUID(),
      severity: 'info',
      title: `X-Powered-By exposed on ${domain}`,
      description: fp.poweredBy,
      remediation: 'Remove or genericize X-Powered-By in production.',
    });
  }
  return out;
}

export async function runScan(
  input: ScanInput,
  onProgress?: ScanProgressHandler,
): Promise<ScanReport> {
  const log = (level: 'debug' | 'info' | 'warn', message: string, context?: string) =>
    onProgress?.({ kind: 'log', level, message, context });

  onProgress?.({ kind: 'stage', stage: 'normalize', message: 'Normalizing domain scope' });
  const domains = normalizeDomains(input.domains, input.maxDomains);
  if (domains.length === 0) {
    throw new Error('No valid domains were provided after normalization.');
  }
  log('info', `Scope: ${domains.length} domain(s): ${domains.join(', ')}`, 'normalize');

  const state: ScanState = {
    input,
    domains,
    findings: [],
    results: [],
    integrationSkips: [],
  };
  const collectors = createCollectors(log);
  for (const collector of collectors) {
    const stageMessage =
      collector.stage === 'dns'
        ? 'Collecting DNS records'
        : collector.stage === 'fingerprint'
          ? 'HTTP fingerprint (passive HEAD / active GET)'
          : 'Security posture summary';
    onProgress?.({ kind: 'stage', stage: collector.stage, message: stageMessage });
    await collector.run(state, onProgress);
  }
  log('info', `Total findings (pre-dedupe): ${String(state.findings.length)}`, 'security');
  const dedupedFindings = dedupeFindings(state.findings);
  log('info', `Total findings (post-dedupe): ${String(dedupedFindings.length)}`, 'security');

  onProgress?.({ kind: 'stage', stage: 'report', message: 'Writing report artifacts' });
  const report: ScanReport = {
    schema: 'spear.aegros/cli-report@v2',
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    policy: input.policy,
    domains,
    findings: dedupedFindings,
    results: state.results,
    summary: {
      findingsBySeverity: summarizeFindings(dedupedFindings),
      totalDomains: state.domains.length,
      totalFindings: dedupedFindings.length,
    },
    scoring: {
      overallRisk: computeRiskScore(dedupedFindings),
      method: 'reserved',
    },
    infrastructureMap: {
      ...buildInfrastructureMap(state.results),
    },
    integrations: {
      available: classifyAvailableIntegrations(input.integrationKeys),
      skipped: state.integrationSkips,
    },
  };

  await mkdir(dirname(input.outputPath), { recursive: true });
  await writeFile(input.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  log('info', `Wrote JSON report: ${input.outputPath}`, 'report');

  return report;
}

export function createDefaultReportPath(outputDir: string): string {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  return join(outputDir, `report-${stamp}.json`);
}

export function jsonPathToMarkdownPath(jsonPath: string): string {
  if (jsonPath.endsWith('.json')) return `${jsonPath.slice(0, -5)}.md`;
  return `${jsonPath}.md`;
}
