/** Contract for optional Linux scanner sidecar (stdin/stdout JSON lines). */
export const SCANNER_PROTOCOL_V1 = 'aegros.scanner.v1' as const;

export interface LinuxScannerRequestV1 {
  readonly protocol: typeof SCANNER_PROTOCOL_V1;
  readonly stage: string;
  readonly jobId: string;
  readonly payload: unknown;
}

export interface LinuxScannerResponseV1 {
  readonly protocol: typeof SCANNER_PROTOCOL_V1;
  readonly ok: boolean;
  readonly stage: string;
  readonly result?: unknown;
  readonly error?: string;
}
