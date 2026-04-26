#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const main = join(root, 'bundled', 'server', 'main.js');
const portal = join(root, 'bundled', 'portal');

const env = {
  ...process.env,
  AEGROS_PORTAL_DIST: portal,
};

const r = spawnSync(process.execPath, [main, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
process.exit(r.status ?? 1);
