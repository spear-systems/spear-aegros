#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const argv = process.argv.slice(2);
if (argv[0] === '--version' || argv[0] === '-V') {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  process.stdout.write(`${pkg.version}\n`);
  process.exit(0);
}
const main = join(root, 'bundled', 'server', 'main.js');
const portal = join(root, 'bundled', 'portal');

const env = {
  ...process.env,
  AEGROS_PORTAL_DIST: portal,
};

const r = spawnSync(process.execPath, [main, ...argv], {
  stdio: 'inherit',
  env,
});
process.exit(r.status ?? 1);
