import type { JobStatus } from './job-types.js';

/** Versioned JSON report envelope (expand with findings, evidence, scores). */
export interface ReportArtifactV1 {
  readonly schema: 'spear.aegros/report@v1';
  readonly jobId: string;
  readonly status: JobStatus;
  readonly generatedAt: string;
  readonly domains: readonly string[];
  readonly summary: string;
}

export function emptyReportV1(
  jobId: string,
  status: JobStatus,
  domains: readonly string[],
): ReportArtifactV1 {
  return {
    schema: 'spear.aegros/report@v1',
    jobId,
    status,
    generatedAt: new Date().toISOString(),
    domains,
    summary: 'Beta stub — pipeline engines not yet connected.',
  };
}
