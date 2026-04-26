import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactWriter } from '@spearsystems/aegros-core';

export function createFsArtifactWriter(baseDir: string, jobId: string): ArtifactWriter {
  const root = join(baseDir, jobId);
  return {
    async writeJson(stage: string, name: string, data: unknown) {
      const dir = join(root, stage);
      await mkdir(dir, { recursive: true });
      const body = `${JSON.stringify(data, null, 2)}\n`;
      const sha256 = createHash('sha256').update(body).digest('hex');
      const relativePath = join(jobId, stage, name).replaceAll('\\', '/');
      const fullPath = join(baseDir, relativePath);
      await writeFile(fullPath, body, 'utf8');
      return { relativePath, sha256 };
    },
  };
}

/** Normalize base artifacts directory from env. */
export function resolveArtifactsDir(): string {
  const raw = process.env.AEGROS_ARTIFACTS_DIR?.trim();
  if (raw) {
    return raw;
  }
  return join(process.cwd(), 'data', 'artifacts');
}
