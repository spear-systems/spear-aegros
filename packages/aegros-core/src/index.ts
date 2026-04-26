/** Spear Aegros shared public API surface. */

export const AEGROS_CORE_VERSION = '0.1.0-beta.0';

export type { JobStatus, JobSummary } from './job-types.js';
export { normalizeDomainLabel, normalizeDomainsToScope } from './domains.js';
export { PIPELINE_ORDER, type PipelineStage } from './pipeline.js';
export { emptyReportV1, type ReportArtifactV1 } from './reports.js';
export {
  emptyReportV2,
  type ReportArtifactV2,
  type Finding,
  type FindingSeverity,
  type AssetRecord,
  type EvidenceManifestEntry,
} from './report-v2.js';
export { DEFAULT_SCAN_POLICY, parseScanPolicy, type ScanPolicy } from './scan-policy.js';
export type { ArtifactWriter } from './artifact-writer.js';
export {
  executePipeline,
  type PipelineRunnerContext,
  type PipelineBudgets,
  type StageStateMap,
  type StageStateRecord,
} from './pipeline-runner.js';
export {
  SCANNER_PROTOCOL_V1,
  type LinuxScannerRequestV1,
  type LinuxScannerResponseV1,
} from './docker-scanner.js';

/** Provider-agnostic AI completion (implementations live in server/cli adapters). */
export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface AiCompleteRequest {
  readonly messages: readonly AiMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
}

export interface AiCompleteResult {
  readonly text: string;
  readonly finishReason?: string;
}

export interface AiService {
  complete(request: AiCompleteRequest): Promise<AiCompleteResult>;
}
