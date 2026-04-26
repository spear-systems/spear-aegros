#!/usr/bin/env node
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { AEGROS_CORE_VERSION } from '@spearsystems/aegros-core';
import { JobWatch } from './JobWatch.js';
import { loadCliConfig, mergeApiKey, mergeBaseUrl } from './config.js';

function wantsJson(): boolean {
  return process.argv.includes('--json');
}

function out(data: unknown): void {
  if (wantsJson()) {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function err(msg: string, code = 1): void {
  process.stderr.write(`${msg}\n`);
  process.exitCode = code;
}

function authHeaders(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (apiKey) h['X-API-Key'] = apiKey;
  return h;
}

const program = new Command();

program
  .name('aegros')
  .description('Spear Aegros command-line interface (beta)')
  .version(AEGROS_CORE_VERSION)
  .option('--json', 'Machine-readable JSON on stdout (no extra whitespace when set)');

program
  .command('health')
  .description('Check API health')
  .option(
    '-u, --url <base>',
    'API base URL (default: ~/.aegros/config.json or http://127.0.0.1:3000/api)',
  )
  .option('-k, --api-key <key>', 'X-API-Key when API_KEYS_REQUIRED=true')
  .action(async (opts: { url?: string; apiKey?: string }) => {
    const cfg = loadCliConfig();
    const base = mergeBaseUrl(cfg, opts.url);
    const key = mergeApiKey(cfg, opts.apiKey);
    const url = new URL('health', `${base}/`);
    const res = await fetch(url, { headers: authHeaders(key) });
    if (!res.ok) {
      err(`HTTP ${res.status}`, 1);
      return;
    }
    const body: unknown = await res.json();
    out(body);
  });

const jobs = program.command('jobs').description('Scan jobs');

jobs
  .command('create')
  .description('Create a job from comma-separated domains')
  .requiredOption('-d, --domains <csv>', 'Comma-separated hostnames')
  .option('-u, --url <base>', 'API base URL')
  .option('-k, --api-key <key>', 'X-API-Key')
  .option('--policy <p>', 'passive | standard | aggressive', 'passive')
  .option(
    '--ack',
    'Confirm authorized assessment (required when server sets AEGROS_ENFORCE_ACK=true)',
  )
  .action(
    async (opts: {
      domains: string;
      url?: string;
      apiKey?: string;
      policy: string;
      ack?: boolean;
    }) => {
      const cfg = loadCliConfig();
      const base = mergeBaseUrl(cfg, opts.url);
      const key = mergeApiKey(cfg, opts.apiKey);
      const domains = opts.domains
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const url = new URL('v1/jobs', `${base}/`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(key) },
        body: JSON.stringify({
          domains,
          policy: opts.policy,
          ackAuthorized: opts.ack === true ? true : undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        err(`HTTP ${res.status}: ${t}`, 1);
        return;
      }
      const body: unknown = await res.json();
      out(body);
    },
  );

jobs
  .command('get')
  .description('Get job by id')
  .argument('<id>', 'Job UUID')
  .option('-u, --url <base>', 'API base URL')
  .option('-k, --api-key <key>', 'X-API-Key')
  .action(async (id: string, opts: { url?: string; apiKey?: string }) => {
    const cfg = loadCliConfig();
    const base = mergeBaseUrl(cfg, opts.url);
    const key = mergeApiKey(cfg, opts.apiKey);
    const url = new URL(`v1/jobs/${id}`, `${base}/`);
    const res = await fetch(url, { headers: authHeaders(key) });
    if (!res.ok) {
      err(`HTTP ${res.status}`, 1);
      return;
    }
    const body: unknown = await res.json();
    out(body);
  });

jobs
  .command('watch')
  .description('TUI: poll job status until completion')
  .argument('<id>', 'Job UUID')
  .option('-u, --url <base>', 'API base URL')
  .option('-k, --api-key <key>', 'X-API-Key')
  .action((id: string, opts: { url?: string; apiKey?: string }) => {
    if (wantsJson()) {
      err('watch does not support --json', 1);
      return;
    }
    const cfg = loadCliConfig();
    const base = mergeBaseUrl(cfg, opts.url);
    const key = mergeApiKey(cfg, opts.apiKey);
    render(<JobWatch jobId={id} baseUrl={base} apiKey={key} />);
  });

void program.parseAsync(process.argv);
