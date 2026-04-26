/** Minimal job status for pipeline orchestration (expand later). */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobSummary {
  readonly id: string;
  readonly status: JobStatus;
}
