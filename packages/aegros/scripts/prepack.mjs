import { cpSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const repoRoot = join(pkgRoot, '..', '..');

function copyDir(src, dest) {
  if (!existsSync(src)) {
    console.error(`Missing build output: ${src}`);
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

// Build workspace packages (idempotent for npm pack from clean CI)
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npm', ['run', 'build', '-w', '@spearsystems/aegros-core'], repoRoot);
run('npm', ['run', 'build', '-w', '@spearsystems/aegros-portal'], repoRoot);
run('npm', ['run', 'build', '-w', '@spearsystems/aegros-server'], repoRoot);
run('npm', ['run', 'build', '-w', '@spearsystems/aegros-cli'], repoRoot);

const bundled = join(pkgRoot, 'bundled');
rmSync(bundled, { recursive: true, force: true });
mkdirSync(bundled, { recursive: true });

copyDir(join(repoRoot, 'packages', 'aegros-core', 'dist'), join(bundled, 'core'));
copyDir(join(repoRoot, 'packages', 'aegros-server', 'dist'), join(bundled, 'server'));
copyDir(join(repoRoot, 'packages', 'aegros-cli', 'dist'), join(bundled, 'cli'));
copyDir(join(repoRoot, 'packages', 'aegros-portal', 'dist'), join(bundled, 'portal'));

for (const f of ['LICENSE', 'NOTICE']) {
  const src = join(repoRoot, f);
  if (existsSync(src)) {
    copyFileSync(src, join(pkgRoot, f));
  }
}

console.log('Bundled publish artifacts into packages/aegros/bundled');
