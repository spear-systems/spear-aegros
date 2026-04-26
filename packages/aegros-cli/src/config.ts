import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AegrosCliConfig {
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
}

export function loadCliConfig(): AegrosCliConfig {
  const path = join(homedir(), '.aegros', 'config.json');
  if (!existsSync(path)) {
    return {};
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as AegrosCliConfig;
  } catch {
    return {};
  }
}

export function mergeBaseUrl(cli: AegrosCliConfig, flag?: string): string {
  const fromFlag = flag?.trim();
  if (fromFlag) return fromFlag.endsWith('/') ? fromFlag.slice(0, -1) : fromFlag;
  const c = cli.apiBaseUrl?.trim();
  if (c) return c.endsWith('/') ? c.slice(0, -1) : c;
  return 'http://127.0.0.1:3000/api';
}

export function mergeApiKey(cli: AegrosCliConfig, flag?: string): string | undefined {
  const f = flag?.trim();
  if (f) return f;
  return cli.apiKey?.trim();
}
