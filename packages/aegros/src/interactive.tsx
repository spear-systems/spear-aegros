import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import type { IntegrationKeys, ScanPolicy } from './config.js';
import { loadConfig } from './config.js';
import {
  createDefaultReportPath,
  runScan,
  jsonPathToMarkdownPath,
  type ScanProgressEvent,
  type ScanReport,
} from './scanner.js';
import { appendReportIndex, writeMarkdownSummary } from './reports.js';

const LOG_CAP = 500;

function formatLogLine(ev: ScanProgressEvent): string {
  const ts = new Date().toISOString().slice(11, 23);
  if (ev.kind === 'stage') {
    return `${ts} [stage:${ev.stage}] ${ev.message}`;
  }
  const tag = ev.context ? `${ev.level}/${ev.context}` : ev.level;
  return `${ts} [${tag}] ${ev.message}`;
}

function LogPanel(props: {
  readonly lines: readonly string[];
  readonly expanded: boolean;
  readonly stdoutRows: number;
}): React.ReactElement {
  const { lines, expanded, stdoutRows } = props;
  const last = lines.length ? lines[lines.length - 1] : '';
  const maxLines = expanded ? Math.max(8, Math.min(28, Math.max(10, stdoutRows - 14))) : 2;
  const visible = expanded ? lines.slice(-maxLines) : lines.slice(-Math.min(2, lines.length));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={expanded ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="cyan">
          {expanded ? '▼ Activity log' : '▸ Activity log (collapsed)'}
        </Text>
        <Text dimColor>
          {lines.length} lines · <Text color="yellow">l</Text> expand/collapse ·{' '}
          <Text color="yellow">Esc</Text> toggle
        </Text>
      </Box>
      {!expanded ? (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((line, i) => (
            <Text key={`c-${String(i)}`} dimColor={line.includes('[debug]')}>
              {line}
            </Text>
          ))}
          {!last ? <Text dimColor>No log lines yet.</Text> : null}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((line, i) => (
            <Text key={`e-${String(i)}`} dimColor={line.includes('[debug]')}>
              {line}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export interface WizardStart {
  readonly domains: string[];
  readonly policy: ScanPolicy;
  readonly outputPath: string;
  readonly timeoutMs: number;
  readonly maxDomains: number;
  readonly integrationKeys?: IntegrationKeys;
}

function WizardFlow(props: { readonly onStart: (a: WizardStart) => void }): React.ReactElement {
  const [step, setStep] = useState<'d' | 'p' | 'a'>('d');
  const [domains, setDomains] = useState('');
  const [policyIn, setPolicyIn] = useState('');
  const [ack, setAck] = useState('');
  const [cfg, setCfg] = useState<Awaited<ReturnType<typeof loadConfig>> | null>(null);

  useEffect(() => {
    void loadConfig().then(setCfg);
  }, []);

  const defaultPolicy = cfg?.defaultPolicy ?? 'passive';
  const parsePolicy = (raw: string): ScanPolicy => {
    const t = raw.trim().toLowerCase();
    if (t === 'standard' || t === 'aggressive' || t === 'passive') return t;
    return defaultPolicy;
  };

  if (!cfg) {
    return <Text dimColor>Loading config…</Text>;
  }

  if (step === 'd') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>1) Domains (comma-separated)</Text>
        <Text dimColor>Example: example.com, www.example.org</Text>
        <Box>
          <Text color="cyan">{'> '}</Text>
          <TextInput
            value={domains}
            onChange={setDomains}
            onSubmit={(v) => {
              const list = v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              if (list.length === 0) return;
              setDomains(v);
              setStep('p');
            }}
          />
        </Box>
      </Box>
    );
  }

  if (step === 'p') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold>2) Policy</Text>
        <Text dimColor>
          passive — DNS + HTTPS HEAD fingerprint · standard — GET https+http + header checks ·
          aggressive — + www probe
        </Text>
        <Text dimColor>Press Enter for default ({defaultPolicy})</Text>
        <Box>
          <Text color="cyan">{'> '}</Text>
          <TextInput
            value={policyIn}
            onChange={setPolicyIn}
            onSubmit={(v) => {
              setPolicyIn(v);
              setStep('a');
            }}
            placeholder={defaultPolicy}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>3) Authorized use</Text>
      <Text dimColor>Type yes if you are explicitly allowed to test these targets.</Text>
      <Box>
        <Text color="cyan">{'> '}</Text>
        <TextInput
          value={ack}
          onChange={setAck}
          onSubmit={(v) => {
            if (v.trim().toLowerCase() !== 'yes') return;
            const list = domains
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            props.onStart({
              domains: list,
              policy: parsePolicy(policyIn),
              outputPath: createDefaultReportPath(cfg.outputDir),
              timeoutMs: cfg.timeoutMs,
              maxDomains: cfg.maxDomains,
              integrationKeys: cfg.integrationKeys,
            });
          }}
        />
      </Box>
    </Box>
  );
}

function ScanRunner(props: {
  readonly run: WizardStart;
  readonly onBack: () => void;
  readonly writeMarkdown?: boolean;
  readonly allowRerun?: boolean;
}): React.ReactElement {
  const writeMarkdown = props.writeMarkdown !== false;
  const allowRerun = props.allowRerun !== false;
  const { exit } = useApp();
  const stdout = useStdout();
  const rows = stdout.stdout?.rows ?? 24;
  const [logs, setLogs] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState('Starting…');
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [report, setReport] = useState<ScanReport | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > LOG_CAP ? next.slice(-LOG_CAP) : next;
    });
  }, []);

  useInput(
    (input, key) => {
      if (phase === 'running') {
        if (input === 'l' || input === 'L' || key.escape) setExpanded((e) => !e);
        return;
      }
      if (input === 'q' || input === 'Q') exit();
      if (allowRerun && (input === 'r' || input === 'R')) props.onBack();
    },
    { isActive: true },
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rep = await runScan(
          {
            domains: props.run.domains,
            policy: props.run.policy,
            outputPath: props.run.outputPath,
            timeoutMs: props.run.timeoutMs,
            maxDomains: props.run.maxDomains,
            integrationKeys: props.run.integrationKeys,
          },
          (ev) => {
            if (cancelled) return;
            pushLog(formatLogLine(ev));
            if (ev.kind === 'stage') setStatus(ev.message);
          },
        );
        if (cancelled) return;
        if (writeMarkdown) {
          const mdPath = jsonPathToMarkdownPath(props.run.outputPath);
          await writeMarkdownSummary(rep, mdPath);
          pushLog(
            formatLogLine({
              kind: 'log',
              level: 'info',
              message: `Wrote Markdown: ${mdPath}`,
              context: 'report',
            }),
          );
        }
        await appendReportIndex({
          id: rep.id,
          path: props.run.outputPath,
          generatedAt: rep.generatedAt,
          domains: rep.domains,
          findings: rep.findings.length,
        });
        setReport(rep);
        setPhase('done');
        setStatus('Complete');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrMsg(msg);
        setPhase('error');
        setStatus('Failed');
        pushLog(formatLogLine({ kind: 'log', level: 'warn', message: msg, context: 'error' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.run, pushLog, writeMarkdown]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Scan in progress
      </Text>
      <Text>
        Targets: <Text color="cyan">{props.run.domains.join(', ')}</Text> · policy{' '}
        <Text color="yellow">{props.run.policy}</Text>
      </Text>
      <Box marginY={1}>
        <Text>
          Status: <Text color={phase === 'error' ? 'red' : 'yellow'}>{status}</Text>
        </Text>
      </Box>
      <LogPanel lines={logs} expanded={expanded} stdoutRows={rows} />
      {phase === 'done' && report ? (
        <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
          <Text bold>Summary</Text>
          <Text>Report id: {report.id}</Text>
          <Text>Findings: {String(report.findings.length)}</Text>
          <Text>JSON: {props.run.outputPath}</Text>
          <Text dimColor>
            Press q to quit
            {allowRerun ? ' · r to run another' : ''}
          </Text>
        </Box>
      ) : null}
      {phase === 'error' ? (
        <Box marginTop={1}>
          <Text color="red">{errMsg}</Text>
          <Text dimColor>
            Press q to quit
            {allowRerun ? ' · r to try again' : ''}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function InteractiveApp(): React.ReactElement {
  const [run, setRun] = useState<WizardStart | null>(null);

  if (run) {
    return (
      <ScanRunner
        run={run}
        onBack={() => {
          setRun(null);
        }}
        allowRerun
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Spear Aegros — interactive
      </Text>
      <Text dimColor>DNS · HTTP fingerprint · security headers · JSON + Markdown reports</Text>
      <WizardFlow onStart={setRun} />
    </Box>
  );
}

export async function runInteractiveSession(): Promise<void> {
  const { waitUntilExit } = render(<InteractiveApp />);
  await waitUntilExit();
}

function CliTuiBridge(
  props: WizardStart & { readonly writeMarkdown: boolean },
): React.ReactElement {
  const { exit } = useApp();
  const run = useMemo(
    () => ({
      domains: props.domains,
      policy: props.policy,
      outputPath: props.outputPath,
      timeoutMs: props.timeoutMs,
      maxDomains: props.maxDomains,
    }),
    [props.domains, props.policy, props.outputPath, props.timeoutMs, props.maxDomains],
  );
  return (
    <ScanRunner
      run={run}
      onBack={() => exit()}
      writeMarkdown={props.writeMarkdown}
      allowRerun={false}
    />
  );
}

export async function runTuiScan(
  args: WizardStart & { readonly writeMarkdown: boolean },
): Promise<void> {
  const { waitUntilExit } = render(<CliTuiBridge {...args} />);
  await waitUntilExit();
}
