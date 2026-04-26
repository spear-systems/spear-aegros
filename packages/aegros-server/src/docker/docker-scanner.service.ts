import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import type { LinuxScannerRequestV1, LinuxScannerResponseV1 } from '@spearsystems/aegros-core';
import { SCANNER_PROTOCOL_V1 } from '@spearsystems/aegros-core';

/**
 * Optional Linux scanner sidecar via `docker run`.
 * On macOS/Windows without Docker: returns structured skip (caller logs).
 */
@Injectable()
export class DockerScannerService {
  private readonly log = new Logger(DockerScannerService.name);

  isConfigured(): boolean {
    return Boolean(process.env.AEGROS_SCANNER_IMAGE?.trim());
  }

  async run(req: LinuxScannerRequestV1): Promise<LinuxScannerResponseV1> {
    const image = process.env.AEGROS_SCANNER_IMAGE?.trim();
    if (!image) {
      return {
        protocol: SCANNER_PROTOCOL_V1,
        ok: false,
        stage: req.stage,
        error: 'AEGROS_SCANNER_IMAGE not set — skipping Linux sidecar.',
      };
    }
    if (platform() === 'win32' || platform() === 'darwin') {
      this.log.warn(`Docker sidecar on ${platform()}: ensure Docker Desktop is running.`);
    }
    const payload = `${JSON.stringify(req)}\n`;
    return await new Promise((resolve) => {
      const args = ['run', '--rm', '-i', '--network', 'bridge', image];
      const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c: Buffer) => {
        stdout += c.toString();
      });
      child.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      child.on('error', (err) => {
        resolve({
          protocol: SCANNER_PROTOCOL_V1,
          ok: false,
          stage: req.stage,
          error: `docker_spawn_failed: ${err.message}`,
        });
      });
      child.on('close', (code) => {
        if (code !== 0) {
          resolve({
            protocol: SCANNER_PROTOCOL_V1,
            ok: false,
            stage: req.stage,
            error: stderr || `docker_exit_${code}`,
          });
          return;
        }
        try {
          const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
          const parsed = JSON.parse(line) as LinuxScannerResponseV1;
          resolve(parsed);
        } catch {
          resolve({
            protocol: SCANNER_PROTOCOL_V1,
            ok: false,
            stage: req.stage,
            error: `invalid_sidecar_json: ${stdout.slice(0, 200)}`,
          });
        }
      });
      child.stdin?.write(payload);
      child.stdin?.end();
    });
  }
}
