/**
 * Work around npm optional dependency omission (npm/cli#4828) in CI.
 * Ensures rolldown native binding package exists for the current OS/arch.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function bindingForPlatform() {
  const { platform, arch } = process;
  if (platform === 'linux' && arch === 'x64') return '@rolldown/binding-linux-x64-gnu';
  if (platform === 'win32' && arch === 'x64') return '@rolldown/binding-win32-x64-msvc';
  if (platform === 'darwin' && arch === 'arm64') return '@rolldown/binding-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return '@rolldown/binding-darwin-x64';
  return null;
}

function canRequire(name) {
  try {
    require(name);
    return true;
  } catch {
    return false;
  }
}

const binding = bindingForPlatform();
if (!binding) {
  console.log('ensure-native-bindings: skip (unsupported platform/arch)');
  process.exit(0);
}

let rolldownVersion;
try {
  rolldownVersion = require(require.resolve('rolldown/package.json')).version;
} catch {
  console.log('ensure-native-bindings: skip (rolldown not installed)');
  process.exit(0);
}

if (canRequire(binding)) {
  console.log(`ensure-native-bindings: ok (${binding})`);
  process.exit(0);
}

console.log(`ensure-native-bindings: installing ${binding}@${rolldownVersion}`);
execSync(`npm install "${binding}@${rolldownVersion}" --no-save --workspaces=false`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_ignore_scripts: 'true',
  },
});

if (!canRequire(binding)) {
  console.error(`ensure-native-bindings: failed to load ${binding}`);
  process.exit(1);
}

console.log(`ensure-native-bindings: installed ${binding}`);
