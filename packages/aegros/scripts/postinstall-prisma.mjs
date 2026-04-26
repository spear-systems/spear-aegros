/**
 * After `npm install -g @spearsystems/aegros`, generate the Prisma client so
 * `aegros-server` can load `@prisma/client`. No-op when `bundled/prisma` or
 * the `prisma` CLI package is missing (e.g. monorepo clone before `npm run build`).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const schema = join(root, 'bundled', 'prisma', 'schema.prisma');
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(schema) || !existsSync(prismaCli)) {
  process.exit(0);
}

const r = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', schema], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(r.status ?? 0);
