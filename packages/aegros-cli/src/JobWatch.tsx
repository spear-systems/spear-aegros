import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

export interface JobWatchProps {
  readonly jobId: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
}

export function JobWatch({ jobId, baseUrl, apiKey }: JobWatchProps) {
  const [line, setLine] = useState<string>('loading…');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-API-Key'] = apiKey;
    let cancelled = false;
    const poll = { id: undefined as ReturnType<typeof setInterval> | undefined };
    const tick = async () => {
      try {
        const url = new URL(`v1/jobs/${jobId}`, `${baseUrl}/`);
        const res = await fetch(url, { headers });
        if (!res.ok) {
          if (!cancelled) setErr(`HTTP ${res.status}`);
          return;
        }
        const body = (await res.json()) as {
          status: string;
          currentStage: string | null;
          stages: Record<string, { status?: string }> | null;
        };
        const stages = body.stages
          ? Object.entries(body.stages)
              .map(([k, v]) => `${k}:${v.status ?? '?'}`)
              .join(' ')
          : '';
        if (!cancelled) {
          setLine(`status=${body.status} stage=${body.currentStage ?? '-'} ${stages}`.trim());
          setErr(null);
        }
        if (
          body.status === 'succeeded' ||
          body.status === 'failed' ||
          body.status === 'cancelled'
        ) {
          if (poll.id) clearInterval(poll.id);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    poll.id = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      if (poll.id) clearInterval(poll.id);
    };
  }, [jobId, baseUrl, apiKey]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Job {jobId}</Text>
      {err ? <Text color="red">{err}</Text> : <Text>{line}</Text>}
      <Text dimColor>Poll mode (Ctrl+C to exit)</Text>
    </Box>
  );
}
