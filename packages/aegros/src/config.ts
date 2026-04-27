import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type ScanPolicy = 'passive' | 'standard' | 'aggressive';
export type OptionalIntegrationId = 'virustotal' | 'alienvault-otx' | 'abuseipdb' | 'safebrowsing';

export type IntegrationKeys = Partial<Record<OptionalIntegrationId, string>>;

export interface AegrosConfig {
  readonly defaultPolicy: ScanPolicy;
  readonly outputDir: string;
  readonly timeoutMs: number;
  readonly maxDomains: number;
  readonly ackAuthorizedUse: boolean;
  readonly integrationKeys?: IntegrationKeys;
}

export const DEFAULT_CONFIG: AegrosConfig = {
  defaultPolicy: 'passive',
  outputDir: join(homedir(), '.spear-aegros', 'reports'),
  timeoutMs: 8000,
  maxDomains: 25,
  ackAuthorizedUse: false,
};

export function getConfigPath(): string {
  return join(homedir(), '.spear-aegros', 'config.json');
}

function sanitizeConfig(input: Partial<AegrosConfig>): AegrosConfig {
  const policy = input.defaultPolicy;
  const defaultPolicy: ScanPolicy =
    policy === 'standard' || policy === 'aggressive' ? policy : 'passive';
  const timeoutMs =
    typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs) && input.timeoutMs > 999
      ? Math.round(input.timeoutMs)
      : DEFAULT_CONFIG.timeoutMs;
  const maxDomains =
    typeof input.maxDomains === 'number' &&
    Number.isFinite(input.maxDomains) &&
    input.maxDomains > 0
      ? Math.round(input.maxDomains)
      : DEFAULT_CONFIG.maxDomains;
  const outputDir = input.outputDir?.trim() ? input.outputDir.trim() : DEFAULT_CONFIG.outputDir;
  const integrationKeysInput = input.integrationKeys ?? {};
  const integrationKeys: IntegrationKeys = {
    virustotal: integrationKeysInput['virustotal']?.trim() || undefined,
    'alienvault-otx': integrationKeysInput['alienvault-otx']?.trim() || undefined,
    abuseipdb: integrationKeysInput['abuseipdb']?.trim() || undefined,
    safebrowsing: integrationKeysInput['safebrowsing']?.trim() || undefined,
  };
  const hasIntegrationKeys = Object.values(integrationKeys).some(Boolean);
  return {
    defaultPolicy,
    outputDir,
    timeoutMs,
    maxDomains,
    ackAuthorizedUse: input.ackAuthorizedUse === true,
    integrationKeys: hasIntegrationKeys ? integrationKeys : undefined,
  };
}

export async function loadConfig(): Promise<AegrosConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AegrosConfig>;
    return sanitizeConfig(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Partial<AegrosConfig>): Promise<AegrosConfig> {
  const path = getConfigPath();
  const next = sanitizeConfig(config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export async function resetConfig(): Promise<void> {
  await rm(getConfigPath(), { force: true });
}
