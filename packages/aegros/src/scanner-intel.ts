import { randomUUID } from 'node:crypto';
import { resolve4, resolveCname } from 'node:dns/promises';
import { connect } from 'node:net';
import tls from 'node:tls';
import type { Finding } from './scanner.js';
import type { ScanPolicy } from './config.js';

interface FetchJsonOptions {
  readonly timeoutMs: number;
  readonly headers?: Record<string, string>;
}

export interface TlsSnapshot {
  readonly protocol?: string;
  readonly cipher?: string;
  readonly issuer?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly san?: readonly string[];
  readonly selfSigned?: boolean;
  readonly signatureAlgorithm?: string;
}

export interface DeliverySnapshot {
  readonly cdnProviders: readonly string[];
  readonly wafProviders: readonly string[];
}

export interface HostingSnapshot {
  readonly ip: string;
  readonly asn?: string;
  readonly asnName?: string;
  readonly prefix?: string;
  readonly country?: string;
}

export interface DomainLifecycleSnapshot {
  readonly registrar?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly expiresAt?: string;
  readonly statuses: readonly string[];
  readonly nameservers: readonly string[];
}

export interface StorageExposureSnapshot {
  readonly provider: 's3' | 'gcs';
  readonly variant: string;
  readonly status: number;
  readonly url: string;
}

async function fetchText(url: string, options: FetchJsonOptions): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: options.headers,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T | null> {
  const text = await fetchText(url, options);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeSubdomain(host: string, rootDomain: string): string | null {
  const trimmed = host.trim().toLowerCase().replace(/^\*\./, '');
  if (!trimmed || !trimmed.endsWith(`.${rootDomain}`) || trimmed === rootDomain) return null;
  return trimmed;
}

function parseHostsFromText(input: string, rootDomain: string): string[] {
  const hosts = new Set<string>();
  const regex = /(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;
  const matches = input.match(regex) ?? [];
  for (const candidate of matches) {
    const normalized = normalizeSubdomain(candidate, rootDomain);
    if (normalized) hosts.add(normalized);
  }
  return [...hosts];
}

export async function discoverSubdomains(
  domain: string,
  policy: ScanPolicy,
  timeoutMs: number,
  log: (level: 'debug' | 'info' | 'warn', message: string, context?: string) => void,
): Promise<{ subdomains: string[]; sourceMap: Record<string, string[]>; findings: Finding[] }> {
  const sourceMap = new Map<string, Set<string>>();
  const findings: Finding[] = [];
  const add = (host: string, source: string) => {
    const entry = sourceMap.get(host) ?? new Set<string>();
    entry.add(source);
    sourceMap.set(host, entry);
  };

  const crt = await fetchText(`https://crt.sh/?q=%25.${domain}&output=json`, { timeoutMs });
  if (crt) {
    for (const host of parseHostsFromText(crt, domain)) add(host, 'crt.sh');
  }

  const hostsearch = await fetchText(`https://api.hackertarget.com/hostsearch/?q=${domain}`, {
    timeoutMs,
  });
  if (hostsearch) {
    for (const line of hostsearch.split(/\r?\n/)) {
      const [host] = line.split(',');
      const normalized = normalizeSubdomain(host ?? '', domain);
      if (normalized) add(normalized, 'hackertarget');
    }
  }

  const threatCrowd = await fetchJson<{ subdomains?: string[] }>(
    `https://www.threatcrowd.org/searchApi/v2/domain/report/?domain=${domain}`,
    { timeoutMs },
  );
  for (const host of threatCrowd?.subdomains ?? []) {
    const normalized = normalizeSubdomain(host, domain);
    if (normalized) add(normalized, 'threatcrowd');
  }

  const rapidDns = await fetchText(`https://rapiddns.io/subdomain/${domain}?full=1`, { timeoutMs });
  if (rapidDns) {
    for (const host of parseHostsFromText(rapidDns, domain)) add(host, 'rapiddns');
  }

  const wayback = await fetchText(
    `https://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=text&fl=original&collapse=urlkey`,
    { timeoutMs },
  );
  if (wayback) {
    const urls = wayback.split(/\r?\n/).filter(Boolean);
    for (const raw of urls) {
      try {
        const host = new URL(raw).hostname;
        const normalized = normalizeSubdomain(host, domain);
        if (normalized) add(normalized, 'wayback');
      } catch {
        // ignore parse errors
      }
    }
  }

  if (policy === 'aggressive') {
    for (const prefix of [
      'www',
      'api',
      'mail',
      'dev',
      'staging',
      'test',
      'admin',
      'app',
      'cdn',
      'static',
    ]) {
      const host = `${prefix}.${domain}`;
      try {
        const addresses = await resolve4(host);
        if (addresses.length) add(host, 'bruteforce');
      } catch {
        // ignored
      }
    }
  }

  const subdomains = [...sourceMap.keys()].sort();
  log('info', `Discovered ${String(subdomains.length)} subdomains for ${domain}`, 'subdomains');
  return {
    subdomains,
    sourceMap: Object.fromEntries([...sourceMap.entries()].map(([k, v]) => [k, [...v].sort()])),
    findings,
  };
}

const TAKEOVER_SIGNATURES: { service: string; markers: string[] }[] = [
  { service: 'github-pages', markers: ["There isn't a GitHub Pages site here"] },
  { service: 'aws-s3', markers: ['NoSuchBucket', 'The specified bucket does not exist'] },
  { service: 'azure', markers: ['404 Web Site not found'] },
  { service: 'heroku', markers: ['No such app'] },
  { service: 'netlify', markers: ['Not Found - Request ID'] },
  { service: 'vercel', markers: ['The deployment could not be found'] },
  { service: 'fastly', markers: ['Fastly error: unknown domain'] },
];

export async function scanTakeoverCandidates(
  rootDomain: string,
  subdomains: readonly string[],
  timeoutMs: number,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const subdomain of subdomains) {
    let cname: string | null = null;
    try {
      const records = await resolveCname(subdomain);
      cname = records[0] ?? null;
    } catch {
      continue;
    }
    if (!cname) continue;
    let body = '';
    try {
      const res = await fetch(`https://${subdomain}/`, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      body = await res.text();
    } catch {
      // ignore network issues
    }
    const signature = TAKEOVER_SIGNATURES.find((entry) =>
      entry.markers.some((marker) => body.toLowerCase().includes(marker.toLowerCase())),
    );
    if (signature) {
      findings.push({
        id: randomUUID(),
        severity: 'critical',
        title: `Potential subdomain takeover (${signature.service})`,
        description: `${subdomain} CNAME points to ${cname} and response matched known takeover signature.`,
        remediation: 'Remove stale DNS records or claim the backing service resource.',
        affectedAssets: [rootDomain, subdomain, cname],
      });
      continue;
    }
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `Suspicious external CNAME for ${subdomain}`,
      description: `${subdomain} points to ${cname} without a positive service health match.`,
      remediation: 'Verify ownership and active provisioning for this external CNAME target.',
      affectedAssets: [rootDomain, subdomain, cname],
    });
  }
  return findings;
}

export async function collectTlsSnapshot(
  domain: string,
  timeoutMs: number,
): Promise<TlsSnapshot | undefined> {
  return await new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();
        const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : undefined;
        const validFrom = cert?.valid_from ? new Date(cert.valid_from).toISOString() : undefined;
        const sans =
          typeof cert?.subjectaltname === 'string'
            ? cert.subjectaltname
                .split(',')
                .map((entry: string) => entry.trim().replace(/^DNS:/i, ''))
                .filter(Boolean)
            : [];
        socket.end();
        const issuerOrg = cert?.issuer?.O;
        const issuerOrgValue = Array.isArray(issuerOrg) ? issuerOrg[0] : issuerOrg;
        const issuerCn = cert?.issuer?.CN;
        const issuerCnValue = Array.isArray(issuerCn) ? issuerCn[0] : issuerCn;
        resolve({
          protocol: protocol ?? undefined,
          cipher: cipher?.name,
          issuer: issuerOrgValue ?? issuerCnValue ?? undefined,
          validFrom,
          validTo,
          san: sans,
          selfSigned: cert?.issuerCertificate === cert,
          signatureAlgorithm: undefined,
        });
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(undefined);
    });
    socket.on('error', () => resolve(undefined));
  });
}

export function findingsForTls(domain: string, tlsSnapshot: TlsSnapshot | undefined): Finding[] {
  if (!tlsSnapshot) return [];
  const findings: Finding[] = [];
  if (tlsSnapshot.validTo) {
    const daysLeft = Math.floor(
      (new Date(tlsSnapshot.validTo).getTime() - Date.now()) / 86_400_000,
    );
    if (daysLeft < 0) {
      findings.push({
        id: randomUUID(),
        severity: 'critical',
        title: `Certificate expired for ${domain}`,
        description: `TLS certificate expired ${String(Math.abs(daysLeft))} day(s) ago.`,
        remediation: 'Rotate certificate immediately and validate chain deployment.',
        affectedAssets: [domain],
      });
    } else if (daysLeft < 7) {
      findings.push({
        id: randomUUID(),
        severity: 'high',
        title: `Certificate near expiry for ${domain}`,
        description: `TLS certificate expires in ${String(daysLeft)} day(s).`,
        remediation: 'Renew and deploy certificate before expiry.',
        affectedAssets: [domain],
      });
    } else if (daysLeft < 14) {
      findings.push({
        id: randomUUID(),
        severity: 'medium',
        title: `Certificate expiry warning for ${domain}`,
        description: `TLS certificate expires in ${String(daysLeft)} day(s).`,
        remediation: 'Schedule renewal in current maintenance window.',
        affectedAssets: [domain],
      });
    }
  }
  if (tlsSnapshot.selfSigned) {
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `Self-signed certificate on ${domain}`,
      description: 'Endpoint appears to present a self-signed certificate.',
      remediation: 'Use a certificate issued by a trusted public CA for internet-facing services.',
      affectedAssets: [domain],
    });
  }
  if ((tlsSnapshot.protocol ?? '').includes('1.0')) {
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `Legacy TLS version on ${domain}`,
      description: `Endpoint negotiated ${tlsSnapshot.protocol}.`,
      remediation: 'Disable TLS 1.0/1.1 and require TLS 1.2+.',
      affectedAssets: [domain],
    });
  }
  return findings;
}

export async function detectCdnWaf(
  domain: string,
  timeoutMs: number,
): Promise<DeliverySnapshot | undefined> {
  try {
    const res = await fetch(`https://${domain}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const headers = res.headers;
    const providers: string[] = [];
    if (headers.has('cf-ray')) providers.push('cloudflare');
    if (headers.has('x-amz-cf-id')) providers.push('cloudfront');
    if (headers.has('x-vercel-id')) providers.push('vercel');
    if (headers.has('x-nf-request-id')) providers.push('netlify');
    const wafSignals: string[] = [];
    if (headers.has('x-sucuri-id')) wafSignals.push('sucuri');
    if ((res.status === 403 || res.status === 406 || res.status === 429) && providers.length > 0) {
      wafSignals.push(...providers);
    }
    return {
      cdnProviders: providers,
      wafProviders: [...new Set(wafSignals)],
    };
  } catch {
    return undefined;
  }
}

export async function enrichHosting(ip: string, timeoutMs: number): Promise<HostingSnapshot> {
  const data = await fetchJson<{
    data?: { prefix?: string; asn?: { asn?: number; name?: string; country_code?: string } };
  }>(`https://api.bgpview.io/ip/${ip}`, { timeoutMs });
  const asn = data?.data?.asn?.asn;
  return {
    ip,
    asn: typeof asn === 'number' ? `AS${String(asn)}` : undefined,
    asnName: data?.data?.asn?.name,
    prefix: data?.data?.prefix,
    country: data?.data?.asn?.country_code,
  };
}

export async function aggressivePortProbe(ip: string, timeoutMs: number): Promise<number[]> {
  const ports = [
    21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 5432, 6379, 8080, 8443, 9200,
    27017,
  ];
  const open: number[] = [];
  await Promise.all(
    ports.map(
      (port) =>
        new Promise<void>((resolve) => {
          const socket = connect({ host: ip, port });
          const close = () => {
            socket.removeAllListeners();
            socket.destroy();
            resolve();
          };
          socket.setTimeout(timeoutMs, close);
          socket.on('connect', () => {
            open.push(port);
            close();
          });
          socket.on('error', close);
        }),
    ),
  );
  return open.sort((a, b) => a - b);
}

export async function collectDomainLifecycle(
  domain: string,
  timeoutMs: number,
): Promise<DomainLifecycleSnapshot | undefined> {
  const rdap = await fetchJson<{
    events?: { eventAction?: string; eventDate?: string }[];
    entities?: { vcardArray?: unknown[] }[];
    nameservers?: { ldhName?: string }[];
    status?: string[];
  }>(`https://rdap.org/domain/${domain}`, { timeoutMs });
  if (!rdap) return undefined;
  const event = (name: string) =>
    rdap.events?.find((entry) => entry.eventAction === name)?.eventDate;
  return {
    registrar: undefined,
    createdAt: event('registration'),
    updatedAt: event('last changed'),
    expiresAt: event('expiration'),
    statuses: rdap.status ?? [],
    nameservers: (rdap.nameservers ?? []).map((entry) => entry.ldhName ?? '').filter(Boolean),
  };
}

export async function probeBucketExposure(
  domain: string,
  timeoutMs: number,
): Promise<readonly StorageExposureSnapshot[]> {
  const normalized = domain.replace(/\./g, '-');
  const variants = [
    domain,
    normalized,
    `${normalized}-assets`,
    `${normalized}-static`,
    `${normalized}-media`,
    `${normalized}-uploads`,
    `${normalized}-backup`,
    `${normalized}-dev`,
    `${normalized}-staging`,
    `${normalized}-prod`,
    `${normalized}-files`,
    `${normalized}-data`,
    `${normalized}-public`,
  ];
  const checks: {
    provider: 's3' | 'gcs';
    variant: string;
    status: number;
    url: string;
  }[] = [];
  for (const variant of variants) {
    const urls = [
      { provider: 's3', url: `https://${variant}.s3.amazonaws.com/` },
      { provider: 's3', url: `https://s3.amazonaws.com/${variant}/` },
      { provider: 'gcs', url: `https://storage.googleapis.com/${variant}/` },
    ] as const;
    for (const candidate of urls) {
      try {
        const res = await fetch(candidate.url, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs),
        });
        checks.push({
          provider: candidate.provider,
          variant,
          status: res.status,
          url: candidate.url,
        });
      } catch {
        // ignore
      }
    }
  }
  return checks;
}

export function findingsForBucketExposure(
  domain: string,
  exposure: readonly StorageExposureSnapshot[] | undefined,
): Finding[] {
  const findings: Finding[] = [];
  for (const item of exposure ?? []) {
    if (item.status === 200) {
      findings.push({
        id: randomUUID(),
        severity: 'critical',
        title: `Public bucket exposure (${item.provider})`,
        description: `Bucket variant ${item.variant} is publicly accessible at ${item.url}.`,
        remediation: 'Restrict bucket ACL/policy and enforce private access controls.',
        affectedAssets: [domain, item.url],
      });
    } else if (item.status === 403) {
      findings.push({
        id: randomUUID(),
        severity: 'medium',
        title: `Bucket exists but denied (${item.provider})`,
        description: `Access denied confirms existence of ${item.variant} at ${item.url}.`,
        remediation: 'Validate bucket naming and ensure no sensitive naming leakage.',
        affectedAssets: [domain, item.url],
      });
    }
  }
  return findings;
}

export function generateTyposquatCandidates(domain: string, policy: ScanPolicy): string[] {
  if (policy !== 'aggressive') return [];
  const [root, ...rest] = domain.split('.');
  if (!root || rest.length === 0) return [];
  const tld = rest.join('.');
  const variants = new Set<string>();
  variants.add(`${root}${root[root.length - 1]}.${tld}`);
  if (root.length > 3) variants.add(`${root.slice(1)}.${tld}`);
  if (root.length > 3) variants.add(`${root[1]}${root[0]}${root.slice(2)}.${tld}`);
  variants.add(`${root.replace(/o/g, '0')}.${tld}`);
  for (const altTld of ['net', 'org', 'co', 'io', 'xyz', 'info', 'biz', 'us', 'cc']) {
    variants.add(`${root}.${altTld}`);
  }
  return [...variants];
}
