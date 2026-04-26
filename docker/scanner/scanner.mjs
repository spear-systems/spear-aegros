#!/usr/bin/env node
/**
 * Spear Aegros scanner sidecar — protocol `aegros.scanner.v1`.
 * Reads one JSON request per invocation on stdin; prints one JSON response on stdout.
 * Extend this image with licensed scanners (e.g. nuclei) under explicit org policy.
 */
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin });
let buf = '';
rl.on('line', (line) => {
  buf += line;
});
rl.on('close', () => {
  try {
    const req = JSON.parse(buf || '{}');
    const out = {
      protocol: 'aegros.scanner.v1',
      ok: true,
      stage: req.stage ?? 'unknown',
      result: {
        message: 'sidecar_stub',
        received: req,
      },
    };
    process.stdout.write(`${JSON.stringify(out)}\n`);
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({
        protocol: 'aegros.scanner.v1',
        ok: false,
        stage: 'unknown',
        error: e instanceof Error ? e.message : String(e),
      })}\n`,
    );
  }
});
