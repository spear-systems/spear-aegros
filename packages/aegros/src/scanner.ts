import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve4, resolve6, resolveMx, resolveTxt } from 'node:dns/promises';
import { dirname, join } from 'node:path';
import type { ScanPolicy } from './config.js';

export interface ScanInput {
  readonly domains: readonly string[];
  readonly policy: ScanPolicy;
  readonly outputPath: string;
  readonly timeoutMs: number;
  readonly maxDomains: number;
}

export interface Finding {
  readonly id: string;
  readonly severity: 'info' | 'low' | 'medium' | 'high';
  readonly title: string;
  readonly description: string;
  readonly remediation?: string;
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
  };
  http: {
    https?: ProbeResult;
    http?: ProbeResult;
  };
  fingerprint?: HttpFingerprint;
}

export interface ScanReport {
  readonly schema: 'spear.aegros/cli-report@v2';
  readonly id: string;
  readonly generatedAt: string;
  readonly policy: ScanPolicy;
  readonly domains: readonly string[];
  readonly findings: readonly Finding[];
  readonly results: readonly DomainResult[];
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

function flattenTxt(records: string[][]): string[] {
  return records.map((entry) => entry.join(''));
}

async function safeResolve<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
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

  const findings: Finding[] = [];
  const results: DomainResult[] = [];

  onProgress?.({ kind: 'stage', stage: 'dns', message: 'Collecting DNS records' });
  for (const domain of domains) {
    log('info', `DNS lookup: ${domain}`, 'dns');
    const [a, aaaa, mx, txtRecords] = await Promise.all([
      safeResolve(() => resolve4(domain), [] as string[]),
      safeResolve(() => resolve6(domain), [] as string[]),
      safeResolve(() => resolveMx(domain), [] as { exchange: string }[]),
      safeResolve(() => resolveTxt(domain), [] as string[][]),
    ]);

    const txt = flattenTxt(txtRecords);
    log('debug', `${domain} A=${a.join(',') || '—'} AAAA=${aaaa.join(',') || '—'}`, 'dns');

    const hasSpf = txt.some((row) => row.toLowerCase().startsWith('v=spf1'));
    const hasDmarc = (
      await safeResolve(() => resolveTxt(`_dmarc.${domain}`), [] as string[][])
    ).some((row) => row.join('').toLowerCase().startsWith('v=dmarc1'));

    if (!hasSpf) {
      findings.push({
        id: randomUUID(),
        severity: 'low',
        title: `Missing SPF record for ${domain}`,
        description: 'No SPF TXT record was observed.',
        remediation: 'Publish an SPF policy aligned to your legitimate senders.',
      });
    }
    if (!hasDmarc) {
      findings.push({
        id: randomUUID(),
        severity: 'medium',
        title: `Missing DMARC record for ${domain}`,
        description: 'No DMARC policy was observed at _dmarc.',
        remediation: 'Publish DMARC with monitored rollout (p=none -> quarantine -> reject).',
      });
    }

    results.push({
      domain,
      dns: { a, aaaa, mx: mx.map((entry) => entry.exchange), txt },
      http: {},
    });
  }

  onProgress?.({
    kind: 'stage',
    stage: 'fingerprint',
    message: 'HTTP fingerprint (passive HEAD / active GET)',
  });
  const passiveOnly = input.policy === 'passive';

  for (const entry of results) {
    const domain = entry.domain;
    if (passiveOnly) {
      const https = await probeHttp(`https://${domain}/`, input.timeoutMs, 'HEAD', onProgress);
      entry.http.https = https;
      entry.fingerprint = https.fingerprint;
      findings.push(...securityFindingsForFingerprint(domain, https.fingerprint, 'https'));
      if (!https.ok && https.error) {
        findings.push({
          id: randomUUID(),
          severity: 'info',
          title: `HTTPS HEAD failed for ${domain}`,
          description: https.error,
        });
      }
      continue;
    }

    const https = await probeHttp(`https://${domain}/`, input.timeoutMs, 'GET', onProgress);
    entry.http.https = https;
    entry.fingerprint = https.fingerprint;
    findings.push(...securityFindingsForFingerprint(domain, https.fingerprint, 'https'));
    if (!https.ok && https.error) {
      findings.push({
        id: randomUUID(),
        severity: 'info',
        title: `HTTPS GET failed for ${domain}`,
        description: https.error,
      });
    }
    if ((https.status ?? 0) >= 500) {
      findings.push({
        id: randomUUID(),
        severity: 'low',
        title: `Server error on ${https.finalUrl}`,
        description: `HTTP ${String(https.status)}`,
      });
    }

    const httpProbe = await probeHttp(`http://${domain}/`, input.timeoutMs, 'GET', onProgress);
    entry.http.http = httpProbe;
    findings.push(...securityFindingsForFingerprint(domain, httpProbe.fingerprint, 'http'));
    if (!httpProbe.ok && httpProbe.error) {
      findings.push({
        id: randomUUID(),
        severity: 'info',
        title: `HTTP GET failed for ${domain}`,
        description: httpProbe.error,
      });
    }

    if (input.policy === 'aggressive' && !domain.startsWith('www.')) {
      const www = await probeHttp(`https://www.${domain}/`, input.timeoutMs, 'GET', onProgress);
      log(
        'info',
        `Aggressive: www.${domain} → ${String(www.status ?? 'n/a')} ${www.ok ? 'ok' : (www.error ?? 'fail')}`,
        'http',
      );
    }
  }

  onProgress?.({ kind: 'stage', stage: 'security', message: 'Security posture summary' });
  log('info', `Total findings (pre-dedupe): ${String(findings.length)}`, 'security');

  onProgress?.({ kind: 'stage', stage: 'report', message: 'Writing report artifacts' });
  const report: ScanReport = {
    schema: 'spear.aegros/cli-report@v2',
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    policy: input.policy,
    domains,
    findings,
    results,
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
