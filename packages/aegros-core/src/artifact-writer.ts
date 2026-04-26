/** Pluggable artifact persistence (server implements with fs, tests with memory). */
export interface ArtifactWriter {
  writeJson(
    stage: string,
    name: string,
    data: unknown,
  ): Promise<{ relativePath: string; sha256: string }>;
}
