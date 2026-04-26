import { randomUUID } from 'node:crypto';
import type { ArtifactWriter } from './artifact-writer.js';
import type { LinuxScannerRequestV1, LinuxScannerResponseV1 } from './docker-scanner.js';
import { SCANNER_PROTOCOL_V1 } from './docker-scanner.js';
import { collectDnsIntel, summarizeEmailAuthSurface } from './engines/dns-intel.js';
import { fetchCrtShSubdomains } from './engines/passive-crtsh.js';
import { probeHttpUrl } from './engines/http-probe.js';
import { inferTechnologies } from './engines/tech-inference.js';
import { expandSubdomainsHeuristic } from './engines/subdomain-expand.js';
import { correlateVulnsFromTech } from './engines/vuln-correlation.js';
import { PIPELINE_ORDER, type PipelineStage } from './pipeline.js';
import type { ScanPolicy } from './scan-policy.js';
import {
  emptyReportV2,
  type EvidenceManifestEntry,
  type Finding,
  type ReportArtifactV2,
} from './report-v2.js';

export interface PipelineBudgets {
  readonly maxHttpRequests: number;
  readonly maxSubdomains: number;
  readonly wallMs: number;
}

export interface PipelineRunnerContext {
  readonly jobId: string;
  readonly domains: readonly string[];
  readonly policy: ScanPolicy;
  readonly writer: ArtifactWriter;
  readonly fetchImpl: typeof fetch;
  readonly budgets: PipelineBudgets;
  readonly linuxScanner?: (req: LinuxScannerRequestV1) => Promise<LinuxScannerResponseV1>;
  readonly ai?: {
    complete(request: {
      readonly messages: readonly { readonly role: string; readonly content: string }[];
      readonly temperature?: number;
      readonly maxOutputTokens?: number;
    }): Promise<{ readonly text: string }>;
  };
  readonly onStage?: (
    stage: PipelineStage,
    status: 'started' | 'finished' | 'failed',
    detail?: string,
  ) => void;
}

export interface StageStateRecord {
  readonly status: 'pending' | 'running' | 'succeeded' | 'failed';
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly detail?: string;
}

export type StageStateMap = Partial<Record<PipelineStage, StageStateRecord>>;

function deadlineFrom(budgets: PipelineBudgets): number {
  return Date.now() + budgets.wallMs;
}

function timedOut(deadline: number): boolean {
  return Date.now() > deadline;
}

export async function executePipeline(ctx: PipelineRunnerContext): Promise<ReportArtifactV2> {
  const deadline = deadlineFrom(ctx.budgets);
  const stages: StageStateMap = {};
  const evidence: EvidenceManifestEntry[] = [];
  const assets: import('./report-v2.js').AssetRecord[] = [];
  const findings: Finding[] = [];
  let httpUsed = 0;
  let synthesized: ReportArtifactV2 | undefined;

  const mark = (s: PipelineStage, rec: StageStateRecord) => {
    stages[s] = rec;
    ctx.onStage?.(
      s,
      rec.status === 'running' ? 'started' : rec.status === 'failed' ? 'failed' : 'finished',
      rec.detail,
    );
  };

  const runStage = async <T>(stage: PipelineStage, fn: () => Promise<T>): Promise<T> => {
    if (timedOut(deadline)) throw new Error('pipeline_budget_wall_ms_exceeded');
    mark(stage, { status: 'running', startedAt: new Date().toISOString() });
    try {
      const out = await fn();
      mark(stage, {
        status: 'succeeded',
        startedAt: stages[stage]?.startedAt,
        finishedAt: new Date().toISOString(),
      });
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      mark(stage, {
        status: 'failed',
        startedAt: stages[stage]?.startedAt,
        finishedAt: new Date().toISOString(),
        detail: msg,
      });
      throw e;
    }
  };

  const recordArtifact = async (stage: PipelineStage, name: string, data: unknown) => {
    const w = await ctx.writer.writeJson(stage, name, data);
    evidence.push({ stage, relativePath: w.relativePath, sha256: w.sha256 });
  };

  for (const stage of PIPELINE_ORDER) {
    if (timedOut(deadline)) break;
    switch (stage) {
      case 'ingest': {
        await runStage(stage, async () => {
          await recordArtifact(stage, 'scope.json', { domains: ctx.domains, policy: ctx.policy });
          for (const d of ctx.domains) {
            assets.push({ host: d, type: 'domain', notes: 'In-scope apex' });
          }
        });
        break;
      }
      case 'passive_intel': {
        await runStage(stage, async () => {
          const byDomain: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            try {
              byDomain[d] = [...(await fetchCrtShSubdomains(d, ctx.fetchImpl))] as string[];
            } catch {
              byDomain[d] = [];
            }
          }
          await recordArtifact(stage, 'crtsh.json', byDomain);
        });
        break;
      }
      case 'dns': {
        await runStage(stage, async () => {
          const dnsMap: Record<string, unknown> = {};
          for (const d of ctx.domains) {
            const intel = await collectDnsIntel(d);
            const email = summarizeEmailAuthSurface(intel.txt);
            dnsMap[d] = { ...intel, emailAuth: email };
            if (!email.spf) {
              findings.push({
                id: randomUUID(),
                title: `Missing SPF record for ${d}`,
                severity: 'low',
                category: 'email_auth',
                description: 'No TXT record starting with v=spf1 observed.',
                remediation: 'Publish SPF aligned with your sending infrastructure.',
                source: 'deterministic',
              });
            }
            if (!email.dmarc) {
              findings.push({
                id: randomUUID(),
                title: `Missing DMARC record for ${d}`,
                severity: 'medium',
                category: 'email_auth',
                description: 'No DMARC policy detected at default DNS labels.',
                remediation: 'Publish DMARC (_dmarc) with p=none→quarantine→reject rollout.',
                source: 'deterministic',
              });
            }
          }
          await recordArtifact(stage, 'dns.json', dnsMap);
        });
        break;
      }
      case 'subdomains': {
        await runStage(stage, async () => {
          const passive: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            try {
              passive[d] = [...(await fetchCrtShSubdomains(d, ctx.fetchImpl))];
            } catch {
              passive[d] = [];
            }
          }
          const expanded: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            expanded[d] = expandSubdomainsHeuristic(d, passive[d] ?? [], ctx.policy).slice(
              0,
              ctx.budgets.maxSubdomains,
            );
            for (const h of expanded[d]) {
              if (h !== d)
                assets.push({
                  host: h,
                  type: 'subdomain',
                  notes: 'Discovered or heuristic candidate',
                });
            }
          }
          await recordArtifact(stage, 'subdomains.json', expanded);

          if (ctx.policy === 'aggressive' && ctx.linuxScanner) {
            const req: LinuxScannerRequestV1 = {
              protocol: SCANNER_PROTOCOL_V1,
              stage: 'subdomains',
              jobId: ctx.jobId,
              payload: { expanded, policy: ctx.policy },
            };
            const res = await ctx.linuxScanner(req);
            await recordArtifact(stage, 'linux_sidecar.json', res);
            if (!res.ok && res.error) {
              findings.push({
                id: randomUUID(),
                title: 'Linux scanner sidecar reported an error',
                severity: 'info',
                category: 'scanner',
                description: res.error,
                source: 'deterministic',
              });
            }
          }
        });
        break;
      }
      case 'http_probe': {
        await runStage(stage, async () => {
          const passive: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            try {
              passive[d] = [...(await fetchCrtShSubdomains(d, ctx.fetchImpl))];
            } catch {
              passive[d] = [];
            }
          }
          const hosts = new Set<string>();
          for (const d of ctx.domains) {
            for (const h of expandSubdomainsHeuristic(d, passive[d] ?? [], ctx.policy)) {
              hosts.add(h);
              if (hosts.size >= ctx.budgets.maxSubdomains) break;
            }
            if (hosts.size >= ctx.budgets.maxSubdomains) break;
          }
          const probes: unknown[] = [];
          for (const host of hosts) {
            if (httpUsed >= ctx.budgets.maxHttpRequests || timedOut(deadline)) break;
            const url = `https://${host}/`;
            httpUsed += 1;
            const pr = await probeHttpUrl(url, ctx.fetchImpl);
            probes.push(pr);
            assets.push({
              host,
              type: 'web_endpoint',
              url: pr.finalUrl,
              notes: `HTTP ${pr.status}`,
            });
            if (pr.status >= 500) {
              findings.push({
                id: randomUUID(),
                title: `Server error on ${pr.finalUrl}`,
                severity: 'low',
                category: 'availability',
                evidence: `HTTP ${pr.status}`,
                source: 'deterministic',
              });
            }
          }
          await recordArtifact(stage, 'http.json', probes);
        });
        break;
      }
      case 'tech_inference': {
        await runStage(stage, async () => {
          const passive: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            try {
              passive[d] = [...(await fetchCrtShSubdomains(d, ctx.fetchImpl))];
            } catch {
              passive[d] = [];
            }
          }
          const hosts = new Set<string>();
          for (const d of ctx.domains) {
            for (const h of expandSubdomainsHeuristic(d, passive[d] ?? [], ctx.policy)) {
              hosts.add(h);
              if (hosts.size >= ctx.budgets.maxSubdomains) break;
            }
            if (hosts.size >= ctx.budgets.maxSubdomains) break;
          }
          const probeResults = [];
          let used = 0;
          for (const host of hosts) {
            if (used >= ctx.budgets.maxHttpRequests || timedOut(deadline)) break;
            used += 1;
            probeResults.push(await probeHttpUrl(`https://${host}/`, ctx.fetchImpl));
          }
          const signals = inferTechnologies(probeResults);
          await recordArtifact(stage, 'tech.json', { signals, probes: probeResults });
        });
        break;
      }
      case 'vuln_correlation': {
        await runStage(stage, async () => {
          const passive: Record<string, string[]> = {};
          for (const d of ctx.domains) {
            try {
              passive[d] = [...(await fetchCrtShSubdomains(d, ctx.fetchImpl))];
            } catch {
              passive[d] = [];
            }
          }
          const hosts = new Set<string>();
          for (const d of ctx.domains) {
            for (const h of expandSubdomainsHeuristic(d, passive[d] ?? [], ctx.policy)) {
              hosts.add(h);
              if (hosts.size >= ctx.budgets.maxSubdomains) break;
            }
            if (hosts.size >= ctx.budgets.maxSubdomains) break;
          }
          const probeResults = [];
          let used = 0;
          for (const host of hosts) {
            if (used >= ctx.budgets.maxHttpRequests || timedOut(deadline)) break;
            used += 1;
            probeResults.push(await probeHttpUrl(`https://${host}/`, ctx.fetchImpl));
          }
          const signals = inferTechnologies(probeResults);
          const vf = correlateVulnsFromTech(signals);
          findings.push(...vf);
          await recordArtifact(stage, 'vuln.json', { signals, findings: vf });
        });
        break;
      }
      case 'report_synthesis': {
        await runStage(stage, async () => {
          // findings already populated; dedupe by id
          const uniq = new Map(findings.map((f) => [f.id, f]));
          const allFindings = [...uniq.values()];
          let executive: string | undefined;
          if (ctx.ai) {
            const res = await ctx.ai.complete({
              temperature: 0.2,
              maxOutputTokens: 800,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a security analyst. Write a short executive summary (max 120 words) from the structured facts only. Do not invent CVEs or products not listed.',
                },
                {
                  role: 'user',
                  content: JSON.stringify({
                    domains: ctx.domains,
                    findings: allFindings.map((f) => ({
                      title: f.title,
                      severity: f.severity,
                      category: f.category,
                    })),
                  }),
                },
              ],
            });
            executive = res.text.trim();
          }
          synthesized = {
            ...emptyReportV2(ctx.jobId, 'succeeded', ctx.domains, ctx.policy),
            summary: `Assessment completed for ${ctx.domains.join(', ')} — ${allFindings.length} finding(s).`,
            executiveSummary: executive,
            findings: allFindings,
            assets,
            evidence: [...evidence],
            disclaimers: [
              ...emptyReportV2(ctx.jobId, 'succeeded', ctx.domains, ctx.policy).disclaimers,
              'Subdomains include passive CT and light heuristics; validate ownership before testing deeper.',
            ],
          };
          await recordArtifact(stage, 'report.json', synthesized);
        });
        break;
      }
      default:
        break;
    }
  }

  const uniq = new Map(findings.map((f) => [f.id, f]));
  const allFindings = [...uniq.values()];
  if (synthesized) return synthesized;
  return {
    ...emptyReportV2(ctx.jobId, 'succeeded', ctx.domains, ctx.policy),
    summary: `Assessment completed for ${ctx.domains.join(', ')} — ${allFindings.length} finding(s).`,
    findings: allFindings,
    assets,
    evidence,
    disclaimers: emptyReportV2(ctx.jobId, 'succeeded', ctx.domains, ctx.policy).disclaimers,
  };
}
