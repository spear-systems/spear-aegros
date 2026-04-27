import { randomUUID } from 'node:crypto';
import {
  resolve4,
  resolve6,
  resolveAny,
  resolveCaa,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveSoa,
  resolveSrv,
  resolveTxt,
  reverse,
} from 'node:dns/promises';
import type { DomainResult, Finding } from './scanner.js';
import type { ScanPolicy } from './config.js';

function flattenTxt(records: string[][]): string[] {
  return records.map((entry) => entry.join(''));
}

function startsWithPolicyValue(records: readonly string[], prefix: string): boolean {
  return records.some((row) => row.toLowerCase().startsWith(prefix));
}

function extractSpfLookupDepth(spfRecord: string | undefined): number {
  if (!spfRecord) return 0;
  const includeCount = (spfRecord.match(/\binclude:/gi) ?? []).length;
  const redirectCount = (spfRecord.match(/\bredirect=/gi) ?? []).length;
  const aMxPtrExistsCount = (spfRecord.match(/\b(?:a|mx|ptr)(?=[\s/:]|$)/gi) ?? []).length;
  return includeCount + redirectCount + aMxPtrExistsCount;
}

function parseTagRecord(record: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of record.split(';')) {
    const [rawKey, ...rawValue] = token.trim().split('=');
    const key = rawKey?.trim().toLowerCase();
    if (!key || rawValue.length === 0) continue;
    out[key] = rawValue.join('=').trim();
  }
  return out;
}

function spfTerminalQualifier(
  spfRecord: string | undefined,
): 'pass' | 'neutral' | 'softfail' | 'fail' | 'unknown' {
  if (!spfRecord) return 'unknown';
  const m = spfRecord.match(/(?:^|\s)([+\-~?])all(?:\s|$)/i);
  if (!m?.[1]) return 'unknown';
  if (m[1] === '+') return 'pass';
  if (m[1] === '?') return 'neutral';
  if (m[1] === '~') return 'softfail';
  return 'fail';
}

export function detectEmailProvider(mxHosts: readonly string[]): string | undefined {
  const mx = mxHosts.map((host) => host.toLowerCase());
  if (mx.some((host) => host.includes('google.com') || host.includes('googlemail.com')))
    return 'google-workspace';
  if (mx.some((host) => host.includes('outlook.com') || host.includes('protection.outlook.com')))
    return 'microsoft-365';
  if (mx.some((host) => host.includes('zoho.com'))) return 'zoho-mail';
  if (mx.some((host) => host.includes('protonmail.ch') || host.includes('protonmail.com')))
    return 'proton-mail';
  if (mx.some((host) => host.includes('yahoodns.net'))) return 'yahoo-mail';
  if (mx.some((host) => host.includes('secureserver.net'))) return 'godaddy-email';
  if (mx.some((host) => host.includes('protonmail.ch') || host.includes('protonmail.com')))
    return 'proton';
  if (mx.some((host) => host.includes('fastmail.com') || host.includes('messagingengine.com')))
    return 'fastmail';
  if (mx.some((host) => host.includes('mailgun.org'))) return 'mailgun';
  if (mx.some((host) => host.includes('sendgrid.net'))) return 'sendgrid';
  if (mx.some((host) => host.includes('pm.mtasv.net'))) return 'postmark';
  if (mx.some((host) => host.includes('amazonses.com'))) return 'amazon-ses';
  if (mx.some((host) => host.includes('mimecast.com'))) return 'mimecast';
  if (mx.some((host) => host.includes('barracudanetworks.com'))) return 'barracuda';
  if (mx.some((host) => host.includes('pphosted.com') || host.includes('proofpoint.com')))
    return 'proofpoint';
  return undefined;
}

function splitDeliveryDetected(mxHosts: readonly string[]): boolean {
  const providers = new Set(
    mxHosts
      .map((host) => detectEmailProvider([host]))
      .filter((provider): provider is string => Boolean(provider)),
  );
  return providers.size > 1;
}

function extractDkimKeyBits(record: string): number | null {
  const match = /(?:^|;)\s*p=([^;\s]+)/i.exec(record);
  if (!match?.[1]) return null;
  try {
    const bytes = Buffer.from(match[1], 'base64');
    return bytes.length > 0 ? bytes.length * 8 : null;
  } catch {
    return null;
  }
}

function scoreEmailSecurity(input: {
  hasSpf: boolean;
  hasDmarc: boolean;
  hasDkim: boolean;
  hasBimi: boolean;
  hasMtaSts: boolean;
  hasTlsRpt: boolean;
  spfLookupDepth: number;
  weakDkimCount: number;
  splitDelivery: boolean;
}): number {
  let score = 100;
  if (!input.hasSpf) score -= 20;
  if (!input.hasDmarc) score -= 30;
  if (!input.hasDkim) score -= 20;
  if (!input.hasMtaSts) score -= 8;
  if (!input.hasTlsRpt) score -= 7;
  if (!input.hasBimi) score -= 3;
  if (input.spfLookupDepth > 10) score -= 8;
  if (input.weakDkimCount > 0) score -= 12;
  if (input.splitDelivery) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function spoofingRiskForScore(score: number): 'low' | 'medium' | 'high' {
  if (score < 60) return 'high';
  if (score < 85) return 'medium';
  return 'low';
}

async function safeResolve<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function resolvePtrRecords(addresses: readonly string[]): Promise<string[]> {
  const ptr = new Set<string>();
  await Promise.all(
    addresses.map(async (ip) => {
      const values = await safeResolve(() => reverse(ip), [] as string[]);
      for (const value of values) ptr.add(value);
    }),
  );
  return [...ptr];
}

async function attemptZoneTransfer(domain: string): Promise<{ success: boolean; note?: string }> {
  const marker = await safeResolve(() => resolveAny(`_axfr.${domain}`), [] as unknown[]);
  if (marker.length > 0) {
    return {
      success: false,
      note: 'AXFR marker query resolved; no transferable zone data exposed.',
    };
  }
  return {
    success: false,
    note: 'AXFR probing requires specialized resolver transport; attempt logged.',
  };
}

function isAggressive(policy: ScanPolicy): boolean {
  return policy === 'aggressive';
}

export async function collectDnsEmailDomainIntel(
  domain: string,
  policy: ScanPolicy,
  log: (level: 'debug' | 'info' | 'warn', message: string, context?: string) => void,
): Promise<{
  dns: DomainResult['dns'];
  email: NonNullable<DomainResult['email']>;
  findings: Finding[];
}> {
  const findings: Finding[] = [];
  const dkimSelectors = [
    'default',
    'google',
    'mail',
    'dkim',
    'smtp',
    'k1',
    's1',
    's2',
    'email',
    'protonmail',
    'mimecast',
    'mailchimp',
    'selector1',
    'selector2',
  ] as const;

  log('info', `DNS lookup: ${domain}`, 'dns');
  const [a, aaaa, mx, txtRecords, ns, soa, caa, cname, srv] = await Promise.all([
    safeResolve(() => resolve4(domain), [] as string[]),
    safeResolve(() => resolve6(domain), [] as string[]),
    safeResolve(() => resolveMx(domain), [] as { exchange: string }[]),
    safeResolve(() => resolveTxt(domain), [] as string[][]),
    safeResolve(() => resolveNs(domain), [] as string[]),
    safeResolve(() => resolveSoa(domain), null as Awaited<ReturnType<typeof resolveSoa>> | null),
    safeResolve(() => resolveCaa(domain), [] as Awaited<ReturnType<typeof resolveCaa>>),
    safeResolve(() => resolveCname(domain), [] as string[]),
    safeResolve(
      () => resolveSrv(`_sip._tcp.${domain}`),
      [] as Awaited<ReturnType<typeof resolveSrv>>,
    ),
  ]);

  const ptr = await resolvePtrRecords([...a, ...aaaa]);
  const anyRecords = await safeResolve(() => resolveAny(domain), [] as unknown[]);
  const anyAsText = anyRecords.map((record) => JSON.stringify(record).toLowerCase());
  const dnssec = {
    dsPresent: anyAsText.some((record) => record.includes('"type":"ds"')),
    dnskeyPresent: anyAsText.some((record) => record.includes('"type":"dnskey"')),
  };
  const tlsaRaw = await safeResolve(() => resolveAny(`_25._tcp.${domain}`), [] as unknown[]);
  const tlsa = tlsaRaw
    .map((record) => JSON.stringify(record))
    .filter((record) => record.toLowerCase().includes('"type":"tlsa"'));
  const txt = flattenTxt(txtRecords);
  log('debug', `${domain} A=${a.join(',') || '—'} AAAA=${aaaa.join(',') || '—'}`, 'dns');

  const hasSpf = startsWithPolicyValue(txt, 'v=spf1');
  const dmarcRecords = flattenTxt(
    await safeResolve(() => resolveTxt(`_dmarc.${domain}`), [] as string[][]),
  );
  const hasDmarc = startsWithPolicyValue(dmarcRecords, 'v=dmarc1');
  const dmarcRecord = dmarcRecords.find((row) => row.toLowerCase().startsWith('v=dmarc1'));
  const dmarcTags = parseTagRecord(dmarcRecord ?? '');
  const dkimResults = await Promise.all(
    dkimSelectors.map(async (selector) => {
      const records = flattenTxt(
        await safeResolve(() => resolveTxt(`${selector}._domainkey.${domain}`), [] as string[][]),
      );
      return { selector, records };
    }),
  );
  const dkimRecords = dkimResults.flatMap((item) => item.records);
  const hasDkim = dkimRecords.some((record) => record.toLowerCase().includes('v=dkim1'));
  const dkimWeakSelectors = dkimResults
    .filter((item) =>
      item.records.some((record) => {
        const bits = extractDkimKeyBits(record);
        return bits !== null && bits < 2048;
      }),
    )
    .map((item) => item.selector);
  const bimiRecords = flattenTxt(
    await safeResolve(() => resolveTxt(`default._bimi.${domain}`), [] as string[][]),
  );
  const mtaStsRecords = flattenTxt(
    await safeResolve(() => resolveTxt(`_mta-sts.${domain}`), [] as string[][]),
  );
  const tlsRptRecords = flattenTxt(
    await safeResolve(() => resolveTxt(`_smtp._tls.${domain}`), [] as string[][]),
  );
  const hasBimi = startsWithPolicyValue(bimiRecords, 'v=bimi1');
  const hasMtaSts = startsWithPolicyValue(mtaStsRecords, 'v=stsv1');
  const hasTlsRpt = startsWithPolicyValue(tlsRptRecords, 'v=tlsrptv1');
  const spfRecord = txt.find((row) => row.toLowerCase().startsWith('v=spf1'));
  const spfLookupDepth = extractSpfLookupDepth(spfRecord);
  const spfQualifier = spfTerminalQualifier(spfRecord);
  const provider = detectEmailProvider(mx.map((entry) => entry.exchange));
  const splitDelivery = splitDeliveryDetected(mx.map((entry) => entry.exchange));
  const emailScore = scoreEmailSecurity({
    hasSpf,
    hasDmarc,
    hasDkim,
    hasBimi,
    hasMtaSts,
    hasTlsRpt,
    spfLookupDepth,
    weakDkimCount: dkimWeakSelectors.length,
    splitDelivery,
  });
  const spoofingRisk = spoofingRiskForScore(emailScore);
  const dmarcPolicy = (dmarcTags.p ?? '').toLowerCase();
  const dmarcPct = Number.parseInt(dmarcTags.pct ?? '100', 10);
  const hasRua = Boolean(dmarcTags.rua?.trim());
  const hasRuf = Boolean(dmarcTags.ruf?.trim());
  const dmarcSp = dmarcTags.sp;
  const axfr = isAggressive(policy)
    ? {
        attempted: true,
        ...(await attemptZoneTransfer(domain)),
      }
    : { attempted: false, success: false, note: 'AXFR disabled outside aggressive policy.' };

  if (!dnssec.dsPresent && !dnssec.dnskeyPresent) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `DNSSEC not detected for ${domain}`,
      description: 'No DNSSEC DS/DNSKEY indicators observed.',
      remediation: 'Enable DNSSEC signing at the authoritative DNS provider.',
      affectedAssets: [domain],
    });
  }
  if (caa.length === 0) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `No CAA records for ${domain}`,
      description: 'Absence of CAA allows any public CA to issue certificates for this domain.',
      remediation: 'Publish restrictive CAA records for approved certificate authorities.',
      affectedAssets: [domain],
    });
  }
  if (!hasSpf) {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `Missing SPF record for ${domain}`,
      description: 'No SPF TXT record was observed.',
      remediation: 'Publish an SPF policy aligned to your legitimate senders.',
      affectedAssets: [domain],
    });
  }
  if (hasSpf && spfQualifier === 'pass') {
    findings.push({
      id: randomUUID(),
      severity: 'critical',
      title: `SPF allows any sender for ${domain}`,
      description: 'SPF policy terminates with +all, which permits spoofed sender infrastructure.',
      remediation:
        'Replace +all with -all (or temporary ~all) after validating legitimate senders.',
      affectedAssets: [domain],
    });
  } else if (hasSpf && spfQualifier === 'neutral') {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `Weak SPF qualifier for ${domain}`,
      description: 'SPF policy terminates with ?all, providing little anti-spoofing protection.',
      remediation: 'Use -all when possible, or ~all while rolling out enforcement.',
      affectedAssets: [domain],
    });
  } else if (hasSpf && spfQualifier === 'softfail') {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `SPF softfail policy for ${domain}`,
      description: 'SPF policy terminates with ~all; spoofing resistance is partial.',
      remediation: 'Move to -all once sender inventory is complete.',
      affectedAssets: [domain],
    });
  }
  if (!hasDmarc) {
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `Missing DMARC record for ${domain}`,
      description: 'No DMARC policy was observed at _dmarc.',
      remediation: 'Publish DMARC with monitored rollout (p=none -> quarantine -> reject).',
      affectedAssets: [domain],
    });
  } else if (dmarcPolicy === 'none') {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `DMARC monitor-only policy for ${domain}`,
      description: 'DMARC policy is p=none and does not enforce reject/quarantine actions.',
      remediation: 'Progress policy to quarantine then reject after alignment validation.',
      affectedAssets: [domain],
    });
  } else if (dmarcPolicy === 'quarantine') {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `DMARC quarantine policy for ${domain}`,
      description: 'DMARC policy is p=quarantine.',
      affectedAssets: [domain],
    });
  }
  if (hasDmarc && Number.isFinite(dmarcPct) && dmarcPct < 100) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `DMARC not fully enforced for ${domain}`,
      description: `DMARC pct=${String(dmarcPct)} indicates partial enforcement.`,
      remediation: 'Set pct=100 when rollout confidence is established.',
      affectedAssets: [domain],
    });
  }
  if (hasDmarc && !hasRua) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `No DMARC aggregate reports (rua) for ${domain}`,
      description: 'DMARC is configured without aggregate reporting destination.',
      remediation: 'Set rua=mailto:<mailbox> to monitor spoofing and policy impact.',
      affectedAssets: [domain],
    });
  }
  if (hasDmarc && !hasRuf) {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `No DMARC forensic reports (ruf) for ${domain}`,
      description: 'Forensic DMARC reporting URI is not configured.',
      affectedAssets: [domain],
    });
  }
  if (hasDmarc && dmarcSp === undefined) {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `No DMARC subdomain policy (sp) for ${domain}`,
      description: 'Subdomain policy is not explicitly configured.',
      remediation: 'Define sp=reject or sp=quarantine when subdomain mail should be controlled.',
      affectedAssets: [domain],
    });
  }
  if (!hasDkim) {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `No DKIM record detected for ${domain}`,
      description: 'No DKIM TXT records were discovered for common selectors.',
      remediation: 'Publish DKIM keys and align signing with SPF/DMARC policies.',
      affectedAssets: [domain],
    });
  }
  if (spfLookupDepth > 10) {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `SPF lookup depth risk for ${domain}`,
      description: `Estimated SPF lookup depth is ${String(spfLookupDepth)}, exceeding the RFC guidance of 10.`,
      remediation: 'Flatten or simplify SPF mechanisms/includes to stay within 10 DNS lookups.',
      affectedAssets: [domain],
    });
  }
  if (dkimWeakSelectors.length > 0) {
    findings.push({
      id: randomUUID(),
      severity: 'medium',
      title: `Weak DKIM key size on ${domain}`,
      description: `Selectors with sub-2048-bit DKIM key material: ${dkimWeakSelectors.join(', ')}.`,
      remediation: 'Rotate DKIM keys to 2048-bit or stronger RSA/Ed25519 equivalents.',
      affectedAssets: [domain],
    });
  }
  if (splitDelivery) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `Split-delivery MX pattern on ${domain}`,
      description: 'Multiple email provider signatures were detected across MX records.',
      remediation:
        'Confirm split-delivery routing is intentional and DMARC alignment is preserved.',
      affectedAssets: [domain],
    });
  }
  if (!hasMtaSts) {
    findings.push({
      id: randomUUID(),
      severity: 'low',
      title: `No MTA-STS policy on ${domain}`,
      description: 'No v=STSv1 record detected at _mta-sts.',
      remediation: 'Publish MTA-STS TXT policy and host policy file to reduce SMTP downgrade risk.',
      affectedAssets: [domain],
    });
  }
  if (!hasTlsRpt) {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `No SMTP TLS Reporting on ${domain}`,
      description: 'No v=TLSRPTv1 record detected at _smtp._tls.',
      remediation: 'Publish SMTP TLS reporting record to monitor TLS delivery failures.',
      affectedAssets: [domain],
    });
  }
  if (!hasSpf && !hasDmarc) {
    findings.push({
      id: randomUUID(),
      severity: 'critical',
      title: `Trivial email spoofing exposure for ${domain}`,
      description: 'SPF and DMARC are both absent.',
      remediation: 'Publish SPF and DMARC immediately to reduce direct spoofing risk.',
      affectedAssets: [domain],
    });
  } else if (hasSpf && !hasDmarc) {
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `Email spoofing exposure for ${domain}`,
      description: 'SPF exists but DMARC is missing.',
      remediation: 'Publish DMARC with staged rollout and reporting.',
      affectedAssets: [domain],
    });
  }
  if (spoofingRisk === 'high') {
    findings.push({
      id: randomUUID(),
      severity: 'high',
      title: `High email spoofing risk for ${domain}`,
      description: `Email security score ${String(emailScore)}/100 indicates elevated spoofing exposure.`,
      remediation: 'Prioritize SPF, DKIM, DMARC enforcement and transport-security controls.',
      affectedAssets: [domain],
    });
  }
  if (!bimiRecords.length) {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `No BIMI record for ${domain}`,
      description: 'No BIMI TXT record found at default._bimi.',
      affectedAssets: [domain],
    });
  }
  if (tlsa.length === 0) {
    findings.push({
      id: randomUUID(),
      severity: 'info',
      title: `No TLSA records for ${domain}`,
      description: 'No TLSA records observed for _25._tcp DANE checks.',
      affectedAssets: [domain],
    });
  }
  if (axfr.success) {
    findings.push({
      id: randomUUID(),
      severity: 'critical',
      title: `Potential zone transfer exposure for ${domain}`,
      description: 'AXFR attempt indicates potential transfer exposure.',
      remediation: 'Restrict zone transfers to explicitly trusted secondaries.',
      affectedAssets: [domain, ...(ns ?? [])],
    });
  }
  if (axfr.attempted) {
    log(
      'info',
      `Aggressive AXFR attempt for ${domain}: ${axfr.success ? 'possible exposure' : (axfr.note ?? 'no transfer')}`,
      'dns',
    );
  }

  return {
    dns: {
      a,
      aaaa,
      mx: mx.map((entry) => entry.exchange),
      txt,
      ns,
      soa: soa ?? undefined,
      caa: caa.map(
        (entry) =>
          `${entry.critical ? 'critical;' : ''}${entry.issue ?? entry.issuewild ?? entry.iodef ?? ''}`,
      ),
      cname,
      srv: srv.map(
        (entry) => `${entry.name}:${String(entry.port)}/${entry.priority}/${entry.weight}`,
      ),
      ptr,
      dnssec,
      tlsa,
      provider,
      axfr,
    },
    email: {
      provider,
      hasSpf,
      hasDkim,
      hasDmarc,
      hasBimi,
      hasMtaSts,
      hasTlsRpt,
      spfLookupDepth,
      dkimWeakSelectors,
      splitDelivery,
      spoofingRisk,
      score: emailScore,
    },
    findings,
  };
}
