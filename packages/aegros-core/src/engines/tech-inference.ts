import type { HttpProbeResult } from './http-probe.js';

export interface TechSignal {
  readonly product: string;
  readonly version?: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly evidence: string;
}

export function inferTechnologies(probes: readonly HttpProbeResult[]): readonly TechSignal[] {
  const out: TechSignal[] = [];
  for (const p of probes) {
    if (p.server) {
      const m =
        /^(nginx|apache|caddy|cloudflare|envoy|istio|microsoft-iis|gunicorn|uvicorn)(?:\/([\w.]+))?/i.exec(
          p.server,
        );
      if (m?.[1]) {
        out.push({
          product: m[1].toLowerCase(),
          version: m[2],
          confidence: m[2] ? 'high' : 'medium',
          evidence: `Server: ${p.server}`,
        });
      } else {
        out.push({
          product: (p.server.split('/')[0] ?? p.server).trim(),
          confidence: 'low',
          evidence: `Server: ${p.server}`,
        });
      }
    }
    if (p.poweredBy) {
      const firstPowered = p.poweredBy.split(',')[0]?.trim() ?? p.poweredBy.trim();
      out.push({
        product: firstPowered,
        confidence: 'medium',
        evidence: `X-Powered-By: ${p.poweredBy}`,
      });
    }
    const ct = p.contentType?.toLowerCase() ?? '';
    if (ct.includes('application/json')) {
      out.push({
        product: 'json_api',
        confidence: 'low',
        evidence: `Content-Type at ${p.finalUrl}`,
      });
    }
  }
  return dedupeSignals(out);
}

function dedupeSignals(signals: TechSignal[]): TechSignal[] {
  const key = (s: TechSignal) => `${s.product}:${s.version ?? ''}`;
  const map = new Map<string, TechSignal>();
  for (const s of signals) {
    const k = key(s);
    const prev = map.get(k);
    if (!prev || rank(s.confidence) > rank(prev.confidence)) map.set(k, s);
  }
  return [...map.values()];
}

function rank(c: TechSignal['confidence']): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}
