/**
 * Pipeline stage identifiers (DAG). Expand as engines land.
 */
export type PipelineStage =
  | 'ingest'
  | 'passive_intel'
  | 'dns'
  | 'subdomains'
  | 'http_probe'
  | 'tech_inference'
  | 'vuln_correlation'
  | 'report_synthesis';

export const PIPELINE_ORDER: readonly PipelineStage[] = [
  'ingest',
  'passive_intel',
  'dns',
  'subdomains',
  'http_probe',
  'tech_inference',
  'vuln_correlation',
  'report_synthesis',
] as const;
