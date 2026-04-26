/**
 * Rolldown (Vitest/Vite) and Rollup (Vite build) ship platform-specific optionalDependencies.
 * npm ci + workspaces often omit them (npm/cli#4828). Install and verify the pair for this OS/arch.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @returns {readonly [string, 'rolldown' | 'rollup'][]} */
function bindingsForPlatform() {
  const { platform, arch } = process;
  if (platform === 'linux' && arch === 'x64') {
    return [
      ['@rolldown/binding-linux-x64-gnu', 'rolldown'],
      ['@rollup/rollup-linux-x64-gnu', 'rollup'],
    ];
  }
  if (platform === 'win32' && arch === 'x64') {
    return [
      ['@rolldown/binding-win32-x64-msvc', 'rolldown'],
      ['@rollup/rollup-win32-x64-msvc', 'rollup'],
    ];
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return [
      ['@rolldown/binding-darwin-arm64', 'rolldown'],
      ['@rollup/rollup-darwin-arm64', 'rollup'],
    ];
  }
  if (platform === 'darwin' && arch === 'x64') {
    return [
      ['@rolldown/binding-darwin-x64', 'rolldown'],
      ['@rollup/rollup-darwin-x64', 'rollup'],
    ];
  }
  return [];
}

function tryRequire(name) {
  try {
    require(name);
    return true;
  } catch {
    return false;
  }
}

const pairs = bindingsForPlatform();
if (pairs.length === 0) {
  console.log('ensure-native-bindings: skip (unknown platform)');
  process.exit(0);
}

let rver;
let uver;
try {
  rver = require(require.resolve('rolldown/package.json')).version;
  uver = require(require.resolve('rollup/package.json')).version;
} catch {
  console.log('ensure-native-bindings: skip (rolldown/rollup not installed)');
  process.exit(0);
}

for (const [name, family] of pairs) {
  const ver = family === 'rolldown' ? rver : uver;
  if (tryRequire(name)) continue;
  console.log(`ensure-native-bindings: installing ${name}@${ver}`);
  execSync(`npm install "${name}@${ver}" --no-save --workspaces=false`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_ignore_scripts: 'true',
    },
  });
  if (!tryRequire(name)) {
    console.error(`ensure-native-bindings: ${name} still not loadable`);
    process.exit(1);
  }
}
