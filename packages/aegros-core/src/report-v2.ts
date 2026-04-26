import type { JobStatus } from './job-types.js';
import type { PipelineStage } from './pipeline.js';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  readonly id: string;
  readonly title: string;
  readonly severity: FindingSeverity;
  readonly category: string;
  readonly description?: string;
  readonly remediation?: string;
  readonly evidence?: string;
  /** Deterministic vs model-assisted narrative */
  readonly source: 'deterministic' | 'ai_assisted';
}

export interface AssetRecord {
  readonly host: string;
  readonly type: 'domain' | 'subdomain' | 'web_endpoint';
  readonly url?: string;
  readonly notes?: string;
}

export interface EvidenceManifestEntry {
  readonly stage: PipelineStage;
  readonly relativePath: string;
  readonly sha256: string;
}

/** Versioned report envelope (production). */
export interface ReportArtifactV2 {
  readonly schema: 'spear.aegros/report@v2';
  readonly jobId: string;
  readonly status: JobStatus;
  readonly generatedAt: string;
  readonly domains: readonly string[];
  readonly policy: import('./scan-policy.js').ScanPolicy;
  readonly summary: string;
  readonly executiveSummary?: string;
  readonly findings: readonly Finding[];
  readonly assets: readonly AssetRecord[];
  readonly evidence: readonly EvidenceManifestEntry[];
  readonly disclaimers: readonly string[];
}

export function emptyReportV2(
  jobId: string,
  status: JobStatus,
  domains: readonly string[],
  policy: import('./scan-policy.js').ScanPolicy,
): ReportArtifactV2 {
  return {
    schema: 'spear.aegros/report@v2',
    jobId,
    status,
    generatedAt: new Date().toISOString(),
    domains,
    policy,
    summary: 'Pipeline initialized.',
    findings: [],
    assets: [],
    evidence: [],
    disclaimers: [
      'CVE and technology correlation are probabilistic; validate findings before remediation.',
      'Use only on systems you are authorized to assess.',
    ],
  };
}
