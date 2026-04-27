#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import {
  getConfigPath,
  loadConfig,
  resetConfig,
  saveConfig,
  type AegrosConfig,
  type IntegrationKeys,
  type ScanPolicy,
} from './config.js';
import {
  createDefaultReportPath,
  jsonPathToMarkdownPath,
  loadDomainsFromFile,
  runScan,
  type ScanReport,
} from './scanner.js';
import {
  appendReportIndex,
  getReportsIndexPath,
  mergeReportList,
  resolveReportPath,
  writeMarkdownSummary,
} from './reports.js';
import { runInteractiveSession, runTuiScan } from './interactive.js';

interface ScanOptions {
  readonly domains?: string;
  readonly domain?: string[];
  readonly domainsFile?: string;
  readonly policy?: ScanPolicy;
  readonly output?: string;
  readonly timeoutMs?: string;
  readonly maxDomains?: string;
  readonly guided?: boolean;
  readonly ackAuthorized?: boolean;
  readonly json?: boolean;
  readonly tui?: boolean;
  readonly noMarkdown?: boolean;
}

function parseIntOption(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseDomainsCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toPolicy(raw: string | undefined, fallback: ScanPolicy): ScanPolicy {
  if (raw === 'passive' || raw === 'standard' || raw === 'aggressive') return raw;
  return fallback;
}

function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function printHint(msg: string): void {
  process.stderr.write(`[hint] ${msg}\n`);
}

function printInfo(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

function redactIntegrationKeys(
  keys: IntegrationKeys | undefined,
): Partial<Record<keyof IntegrationKeys, string>> {
  if (!keys) return {};
  const out: Partial<Record<keyof IntegrationKeys, string>> = {};
  for (const [integration, key] of Object.entries(keys)) {
    if (!key) continue;
    out[integration as keyof IntegrationKeys] = `${key.slice(0, 3)}***${key.slice(-2)}`;
  }
  return out;
}

function resolveIntegrationKeys(cfg: AegrosConfig): IntegrationKeys | undefined {
  const fromConfig = cfg.integrationKeys ?? {};
  const fromEnv: IntegrationKeys = {
    virustotal: process.env.AEGROS_VIRUSTOTAL_API_KEY?.trim(),
    'alienvault-otx': process.env.AEGROS_OTX_API_KEY?.trim(),
    abuseipdb: process.env.AEGROS_ABUSEIPDB_API_KEY?.trim(),
    safebrowsing: process.env.AEGROS_SAFEBROWSING_API_KEY?.trim(),
  };
  const merged: IntegrationKeys = {
    virustotal: fromEnv['virustotal'] || fromConfig['virustotal'],
    'alienvault-otx': fromEnv['alienvault-otx'] || fromConfig['alienvault-otx'],
    abuseipdb: fromEnv['abuseipdb'] || fromConfig['abuseipdb'],
    safebrowsing: fromEnv['safebrowsing'] || fromConfig['safebrowsing'],
  };
  if (!Object.values(merged).some(Boolean)) return undefined;
  return merged;
}

async function getVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', 'package.json');
  const raw = await readFile(pkgPath, 'utf8');
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? '0.0.0';
}

async function promptGuided(defaults: AegrosConfig): Promise<{
  domains: string[];
  policy: ScanPolicy;
  outputPath: string;
  ackAuthorized: boolean;
}> {
  const rl = createInterface({ input, output });
  try {
    const domainsRaw = await rl.question('Enter domains (comma-separated): ');
    const domains = parseDomainsCsv(domainsRaw);

    const policyRaw = await rl.question(
      `Policy [passive|standard|aggressive] (default ${defaults.defaultPolicy}): `,
    );
    const policy = toPolicy(policyRaw.trim() || defaults.defaultPolicy, defaults.defaultPolicy);

    const outputRaw = await rl.question(
      `Report path (leave empty for default in ${defaults.outputDir}): `,
    );
    const outputPath = outputRaw.trim() || createDefaultReportPath(defaults.outputDir);

    const ackRaw = await rl.question(
      'Confirm authorized-use only assessment? Type "yes" to continue: ',
    );
    const ackAuthorized = ackRaw.trim().toLowerCase() === 'yes';

    return { domains, policy, outputPath, ackAuthorized };
  } finally {
    rl.close();
  }
}

function renderSummary(report: ScanReport): void {
  const severityCount = report.findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});

  const lines = [
    '',
    'Spear Aegros scan complete',
    `- report id: ${report.id}`,
    `- generated: ${report.generatedAt}`,
    `- policy: ${report.policy}`,
    `- domains: ${report.domains.join(', ')}`,
    `- findings: ${report.findings.length}`,
    `- by severity: ${
      Object.entries(severityCount)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(', ') || 'none'
    }`,
    '',
  ];

  process.stderr.write(`${lines.join('\n')}\n`);
}

async function resolveDomains(opts: ScanOptions): Promise<string[]> {
  const fromFlag = opts.domain ?? [];
  const fromCsv = parseDomainsCsv(opts.domains);
  const fromFile = opts.domainsFile ? await loadDomainsFromFile(resolve(opts.domainsFile)) : [];
  return [...fromFlag, ...fromCsv, ...fromFile];
}

async function finalizeArtifacts(
  report: ScanReport,
  jsonPath: string,
  writeMd: boolean,
  onLog?: (msg: string) => void,
): Promise<void> {
  if (writeMd) {
    const mdPath = jsonPathToMarkdownPath(jsonPath);
    await writeMarkdownSummary(report, mdPath);
    onLog?.(`Wrote Markdown: ${mdPath}`);
  }
  await appendReportIndex({
    id: report.id,
    path: jsonPath,
    generatedAt: report.generatedAt,
    domains: report.domains,
    findings: report.findings.length,
  });
  onLog?.(`Indexed report: ${jsonPath}`);
}

async function run(): Promise<void> {
  const program = new Command();
  const version = await getVersion();

  const argv = [...process.argv];
  if (argv.length === 2) {
    argv.push('interactive');
  }

  program
    .name('spear-aegros')
    .description(
      'Interactive security CLI: DNS, HTTP fingerprint, headers, reports. Use only on authorized targets.',
    )
    .version(version)
    .showHelpAfterError('(Run with --help for examples.)')
    .addHelpText(
      'after',
      '\nQuick Start:\n' +
        '  spear-aegros\n' +
        '  spear-aegros scan --domain example.com --ack-authorized\n' +
        '\nCommon Workflows:\n' +
        '  spear-aegros                 # full interactive wizard (recommended)\n' +
        '  spear-aegros scan --tui ...  # one-shot run with collapsible live log panel\n' +
        '  spear-aegros reports list    # list saved reports\n' +
        '  spear-aegros reports show <id-or-path>\n' +
        '\nReports:\n' +
        '  - JSON report files and Markdown summaries are saved under ~/.spear-aegros/reports by default.\n' +
        '  - Use `config set --output-dir <path>` to customize.\n' +
        '\nSafety:\n' +
        '  Use only on systems you are explicitly authorized to assess.',
    );

  program
    .command('interactive')
    .alias('i')
    .description('Full-screen interactive session (Ink): wizard + live collapsible logs')
    .action(async () => {
      await runInteractiveSession();
    });

  program
    .command('init')
    .description('Create ~/.spear-aegros/config.json with guided prompts (readline)')
    .action(async () => {
      const cfg = await loadConfig();
      const guided = await promptGuided(cfg);
      const next = await saveConfig({
        ...cfg,
        defaultPolicy: guided.policy,
        outputDir: dirname(resolve(guided.outputPath)),
        ackAuthorizedUse: guided.ackAuthorized,
      });
      printJson({ configPath: getConfigPath(), config: next });
    });

  const config = program.command('config').description('Manage CLI configuration');

  config
    .command('show')
    .description('Print active configuration')
    .action(async () => {
      const cfg = await loadConfig();
      printJson({
        configPath: getConfigPath(),
        config: {
          ...cfg,
          integrationKeys: redactIntegrationKeys(cfg.integrationKeys),
        },
      });
    });

  config
    .command('path')
    .description('Print config file path')
    .action(() => {
      process.stdout.write(`${getConfigPath()}\n`);
    });

  config
    .command('reset')
    .description('Delete local config file')
    .action(async () => {
      await resetConfig();
      printJson({ configPath: getConfigPath(), removed: true });
    });

  config
    .command('set')
    .description('Set one or more config values')
    .option('--default-policy <policy>', 'passive | standard | aggressive')
    .option('--output-dir <path>', 'Default output directory for reports')
    .option('--timeout-ms <number>', 'HTTP probe timeout (ms)')
    .option('--max-domains <number>', 'Cap number of domains processed')
    .option('--ack-authorized-use <bool>', 'Persist legal acknowledgement true|false')
    .option('--virustotal-key <value>', 'VirusTotal API key')
    .option('--otx-key <value>', 'AlienVault OTX API key')
    .option('--abuseipdb-key <value>', 'AbuseIPDB API key')
    .option('--safebrowsing-key <value>', 'Google Safe Browsing API key')
    .action(
      async (opts: {
        defaultPolicy?: string;
        outputDir?: string;
        timeoutMs?: string;
        maxDomains?: string;
        ackAuthorizedUse?: string;
        virustotalKey?: string;
        otxKey?: string;
        abuseipdbKey?: string;
        safebrowsingKey?: string;
      }) => {
        const cfg = await loadConfig();
        const next = await saveConfig({
          ...cfg,
          defaultPolicy: toPolicy(opts.defaultPolicy, cfg.defaultPolicy),
          outputDir: opts.outputDir ? resolve(opts.outputDir) : cfg.outputDir,
          timeoutMs: parseIntOption(opts.timeoutMs, cfg.timeoutMs),
          maxDomains: parseIntOption(opts.maxDomains, cfg.maxDomains),
          ackAuthorizedUse:
            opts.ackAuthorizedUse === undefined
              ? cfg.ackAuthorizedUse
              : opts.ackAuthorizedUse.trim().toLowerCase() === 'true',
          integrationKeys: {
            virustotal:
              opts.virustotalKey === undefined
                ? cfg.integrationKeys?.['virustotal']
                : opts.virustotalKey,
            'alienvault-otx':
              opts.otxKey === undefined ? cfg.integrationKeys?.['alienvault-otx'] : opts.otxKey,
            abuseipdb:
              opts.abuseipdbKey === undefined
                ? cfg.integrationKeys?.['abuseipdb']
                : opts.abuseipdbKey,
            safebrowsing:
              opts.safebrowsingKey === undefined
                ? cfg.integrationKeys?.['safebrowsing']
                : opts.safebrowsingKey,
          },
        });
        printJson({
          configPath: getConfigPath(),
          config: {
            ...next,
            integrationKeys: redactIntegrationKeys(next.integrationKeys),
          },
        });
      },
    )
    .addHelpText(
      'after',
      '\nExamples:\n' +
        '  spear-aegros config show\n' +
        '  spear-aegros config set --default-policy standard --max-domains 50\n' +
        '  spear-aegros config set --output-dir ./reports --timeout-ms 12000\n' +
        '  spear-aegros config set --ack-authorized-use true\n' +
        '  spear-aegros config set --virustotal-key <key> --otx-key <key>',
    );

  const reports = program.command('reports').description('List and open saved JSON reports');

  reports
    .command('list')
    .description('List reports (merges index.jsonl and on-disk JSON)')
    .option('--json', 'Machine-readable output')
    .option('--limit <n>', 'Max reports to print', '50')
    .option('--domain <value>', 'Filter reports containing domain')
    .option('--policy <value>', 'Filter by policy')
    .action(async (opts: { json?: boolean; limit?: string; domain?: string; policy?: string }) => {
      const cfg = await loadConfig();
      const limit = parseIntOption(opts.limit, 50);
      let items = await mergeReportList(cfg.outputDir);
      if (opts.domain?.trim()) {
        const needle = opts.domain.trim().toLowerCase();
        items = items.filter((entry) =>
          entry.domains.some((domain) => domain.toLowerCase() === needle),
        );
      }
      if (opts.policy === 'passive' || opts.policy === 'standard' || opts.policy === 'aggressive') {
        const hits = [];
        for (const entry of items) {
          const resolved = await resolveReportPath(entry.id, cfg.outputDir);
          if (resolved?.report.policy === opts.policy) hits.push(entry);
        }
        items = hits;
      }
      if (opts.json) {
        printJson({ reportsDir: cfg.outputDir, items });
        return;
      }
      for (const e of items.slice(0, limit)) {
        process.stdout.write(
          `${e.generatedAt}  ${e.id}  findings=${String(e.findings)}  ${e.path}\n`,
        );
      }
      if (items.length > limit)
        process.stdout.write(`… and ${String(items.length - limit)} more\n`);
    });

  reports
    .command('latest')
    .description('Print latest report summary')
    .option('--json', 'Print latest full report JSON')
    .action(async (opts: { json?: boolean }) => {
      const cfg = await loadConfig();
      const list = await mergeReportList(cfg.outputDir);
      const latest = list[0];
      if (!latest) {
        process.stderr.write('No reports found.\n');
        process.exitCode = 1;
        return;
      }
      const hit = await resolveReportPath(latest.id, cfg.outputDir);
      if (!hit) {
        process.stderr.write('Latest report could not be read.\n');
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        printJson(hit.report);
        return;
      }
      printJson({
        path: hit.path,
        id: hit.report.id,
        generatedAt: hit.report.generatedAt,
        policy: hit.report.policy,
        domains: hit.report.domains,
        findings: hit.report.findings.length,
        riskScore: hit.report.scoring?.overallRisk ?? null,
      });
    });

  reports
    .command('show')
    .description('Print a report by id, filename, or absolute path')
    .argument('<id-or-path>', 'Report UUID, report-*.json name, or full path')
    .option('--json', 'Print raw JSON to stdout')
    .action(async (idOrPath: string, opts: { json?: boolean }) => {
      const cfg = await loadConfig();
      const hit = await resolveReportPath(idOrPath, cfg.outputDir);
      if (!hit) {
        process.stderr.write('Report not found.\n');
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(hit.report, null, 2)}\n`);
        return;
      }
      printJson({
        path: hit.path,
        id: hit.report.id,
        generatedAt: hit.report.generatedAt,
        policy: hit.report.policy,
        domains: hit.report.domains,
        findings: hit.report.findings.length,
        results: hit.report.results.map((r) => ({
          domain: r.domain,
          fingerprint: r.fingerprint?.finalUrl,
          server: r.fingerprint?.server,
          stack: r.fingerprint?.detectedStack,
        })),
      });
    })
    .addHelpText(
      'after',
      '\nExamples:\n' +
        '  spear-aegros reports list\n' +
        '  spear-aegros reports list --json\n' +
        '  spear-aegros reports show <report-id>\n' +
        '  spear-aegros reports show ./path/to/report-2026-04-27.json --json',
    );

  program
    .command('doctor')
    .description('Validate local setup and show next actions')
    .action(async () => {
      const cfg = await loadConfig();
      const issues: string[] = [];
      if (!cfg.ackAuthorizedUse) {
        issues.push(
          'Authorized-use acknowledgement is not stored; use `spear-aegros config set --ack-authorized-use true` or confirm per scan.',
        );
      }
      if (cfg.maxDomains > 250) {
        issues.push('maxDomains is high; prefer <=250 to limit accidental broad scans.');
      }
      const integrationKeys = resolveIntegrationKeys(cfg);
      const configuredIntegrations = Object.entries(integrationKeys ?? {})
        .filter(([, value]) => Boolean(value))
        .map(([integration]) => integration);
      printJson({
        node: process.version,
        configPath: getConfigPath(),
        reportsDir: cfg.outputDir,
        indexPath: getReportsIndexPath(),
        config: {
          ...cfg,
          integrationKeys: redactIntegrationKeys(cfg.integrationKeys),
        },
        integrations: configuredIntegrations,
        issues,
        next: issues.length === 0 ? 'Ready' : 'Review issues',
      });
    });

  program
    .command('scan')
    .description(
      'Run assessment: DNS, HTTP fingerprint, security headers; writes JSON (+ Markdown)',
    )
    .option(
      '-d, --domain <domain>',
      'Single domain (repeatable)',
      (value: string, acc: string[]) => {
        acc.push(value);
        return acc;
      },
      [],
    )
    .option('--domains <csv>', 'Comma-separated domains')
    .option('--domains-file <path>', 'Text file with one domain per line')
    .option('--policy <policy>', 'passive | standard | aggressive')
    .option('-o, --output <path>', 'Report output path (defaults to config outputDir)')
    .option('--timeout-ms <number>', 'HTTP probe timeout in milliseconds')
    .option('--max-domains <number>', 'Cap number of domains to process')
    .option('--guided', 'Prompt for missing options (readline)')
    .option('--tui', 'Interactive terminal UI with collapsible activity log (requires Ink)')
    .option('--no-markdown', 'Skip Markdown summary next to JSON')
    .option('--ack-authorized', 'Confirm authorized-use assessment for this run')
    .option('--json', 'Print final report JSON to stdout')
    .addHelpText(
      'after',
      '\nExamples:\n' +
        '  spear-aegros scan --domains example.com --policy passive --ack-authorized\n' +
        '  spear-aegros scan --tui --domain example.com --ack-authorized\n' +
        '  spear-aegros interactive\n' +
        '  spear-aegros reports list',
    )
    .action(async (opts: ScanOptions) => {
      const cfg = await loadConfig();
      let domains = await resolveDomains(opts);
      let policy = toPolicy(opts.policy, cfg.defaultPolicy);
      let outputPath = opts.output ? resolve(opts.output) : createDefaultReportPath(cfg.outputDir);
      let ackAuthorized = opts.ackAuthorized === true || cfg.ackAuthorizedUse;

      if (opts.guided) {
        const guided = await promptGuided(cfg);
        if (guided.domains.length > 0) domains = guided.domains;
        policy = guided.policy;
        outputPath = resolve(guided.outputPath);
        ackAuthorized = guided.ackAuthorized;
      }

      if (!ackAuthorized) {
        throw new Error(
          'Authorized-use acknowledgement missing. Use --ack-authorized or set config ack-authorized-use=true.',
        );
      }
      if (domains.length === 0) {
        throw new Error(
          'No domains provided. Use --domain, --domains, --domains-file, --guided, or interactive.',
        );
      }

      const timeoutMs = parseIntOption(opts.timeoutMs, cfg.timeoutMs);
      const maxDomains = parseIntOption(opts.maxDomains, cfg.maxDomains);
      const integrationKeys = resolveIntegrationKeys(cfg);

      if (opts.tui) {
        await runTuiScan({
          domains,
          policy,
          outputPath,
          timeoutMs,
          maxDomains,
          integrationKeys,
          writeMarkdown: !opts.noMarkdown,
        });
        return;
      }

      printHint('Use only on assets you are explicitly authorized to assess.');
      printInfo(`report output: ${outputPath}`);
      const report = await runScan(
        {
          domains,
          policy,
          outputPath,
          timeoutMs,
          maxDomains,
          integrationKeys,
        },
        (event) => {
          if (event.kind === 'log') {
            const prefix =
              event.level === 'warn' ? '[warn]' : event.level === 'debug' ? '[debug]' : '[info]';
            printInfo(`${prefix} ${event.message}`);
          } else {
            printInfo(`stage=${event.stage} ${event.message}`);
          }
        },
      );

      await finalizeArtifacts(report, outputPath, !opts.noMarkdown, (m) => printInfo(m));

      if (opts.json) {
        printJson(report);
      } else {
        renderSummary(report);
        printInfo(`Saved report: ${outputPath}`);
        if (!opts.noMarkdown) printInfo(`Markdown: ${jsonPathToMarkdownPath(outputPath)}`);
      }
    });

  program
    .command('upgrade-help')
    .description('Show clean uninstall/reinstall flow across beta/rc/stable')
    .action(() => {
      printJson({
        uninstall: ['npm uninstall -g @spearsystems/aegros'],
        verifyRemoved: ['where spear-aegros (Windows)', 'which spear-aegros (Linux/macOS)'],
        reinstall: ['npm install -g @spearsystems/aegros@latest'],
        pinExact: [`npm install -g @spearsystems/aegros@${version}`],
        note: 'Global npm install keeps one version. Reinstall replaces older versions globally.',
      });
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

void run();
