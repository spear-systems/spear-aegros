import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'reflect-metadata';

const serverRoot = dirname(fileURLToPath(import.meta.url));
const dbFile = join(tmpdir(), `aegros-vitest-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.API_KEYS_REQUIRED = 'false';
process.env.AEGROS_ARTIFACTS_DIR = join(tmpdir(), `aegros-artifacts-${process.pid}`);
mkdirSync(process.env.AEGROS_ARTIFACTS_DIR, { recursive: true });
process.env.AEGROS_MAX_HTTP = '4';
process.env.AEGROS_MAX_SUBDOMAINS = '12';
process.env.AEGROS_WALL_MS = '60000';

execSync('npx prisma migrate deploy', {
  cwd: serverRoot,
  stdio: 'inherit',
  env: { ...process.env },
});

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  void init;
  if (url.includes('crt.sh')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('<html></html>', {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      server: 'nginx/1.22.1',
    },
  });
};
