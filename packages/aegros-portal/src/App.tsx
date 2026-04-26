import { useCallback, useEffect, useMemo, useState } from 'react';

const API_KEY_STORAGE = 'aegros_portal_api_key';

function apiBase(): string {
  if (import.meta.env.DEV) {
    return '/api';
  }
  return `${window.location.origin}/api`;
}

interface JobRow {
  readonly id: string;
  readonly status: string;
  readonly domains: readonly string[];
  readonly policy?: string;
  readonly createdAt: string;
}

export function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState('example.com');
  const [policy, setPolicy] = useState<'passive' | 'standard' | 'aggressive'>('passive');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (apiKey.trim()) h['X-API-Key'] = apiKey.trim();
    return h;
  }, [apiKey]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${apiBase()}/v1/jobs`, { headers });
      if (!res.ok) {
        setErr(`List failed: HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as JobRow[];
      setJobs(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
  }, [apiKey]);

  const createJob = async () => {
    setErr(null);
    const list = domains
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setErr('Enter at least one domain');
      return;
    }
    const res = await fetch(`${apiBase()}/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ domains: list, policy, ackAuthorized: true }),
    });
    if (!res.ok) {
      setErr(`Create failed: HTTP ${res.status}`);
      return;
    }
    await refresh();
  };

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    setErr(null);
    const res = await fetch(`${apiBase()}/v1/jobs/${id}`, { headers });
    if (!res.ok) {
      setErr(`Detail failed: HTTP ${res.status}`);
      return;
    }
    setDetail(await res.json());
  };

  return (
    <div className="shell">
      <header className="top-nav">
        <span className="top-nav__brand">Spear Aegros</span>
        <nav aria-label="Primary">
          <ul className="top-nav__links">
            <li>
              <a href="/portal/">Jobs</a>
            </li>
            <li>
              <a href="/api/v1/jobs" target="_blank" rel="noreferrer">
                Jobs JSON
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <main className="shell__main">
        <div className="shell__inner">
          <section className="hero">
            <p className="caption" style={{ marginBottom: 'var(--space-12)' }}>
              Operator portal — assessments
            </p>
            <h1 className="h1">External surface intelligence</h1>
            <p className="body" style={{ maxWidth: '720px' }}>
              Create jobs from authorized domains, monitor progress, and inspect reports. When the
              API enforces keys, set your <code>X-API-Key</code> below (stored only in this
              browser).
            </p>
          </section>

          <section style={{ marginBottom: 'var(--space-32)' }}>
            <h2 className="h3">API access</h2>
            <label className="label" htmlFor="api-key">
              X-API-Key (optional if server has API_KEYS_REQUIRED=false)
            </label>
            <input
              id="api-key"
              className="input"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="aeg_…"
            />
          </section>

          <section style={{ marginBottom: 'var(--space-32)' }}>
            <h2 className="h3">New job</h2>
            <label className="label" htmlFor="domains">
              Domains (comma-separated)
            </label>
            <input
              id="domains"
              className="input"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
            />
            <label className="label" htmlFor="policy" style={{ marginTop: 'var(--space-16)' }}>
              Policy
            </label>
            <select
              id="policy"
              className="input"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as typeof policy)}
            >
              <option value="passive">passive</option>
              <option value="standard">standard</option>
              <option value="aggressive">aggressive</option>
            </select>
            <div className="row" style={{ marginTop: 'var(--space-16)' }}>
              <button type="button" className="btn btn--primary" onClick={() => void createJob()}>
                Queue assessment
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void refresh()}
                disabled={loading}
              >
                Refresh list
              </button>
            </div>
            {err ? (
              <p
                className="body"
                style={{ color: 'var(--color-error)', marginTop: 'var(--space-12)' }}
              >
                {err}
              </p>
            ) : null}
          </section>

          <section style={{ marginBottom: 'var(--space-48)' }}>
            <h2 className="h3">Recent jobs</h2>
            <div className="card">
              {jobs.length === 0 ? (
                <p className="body">No jobs yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {jobs.map((j) => (
                    <li
                      key={j.id}
                      style={{
                        padding: 'var(--space-12) 0',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ width: '100%', textAlign: 'left' }}
                        onClick={() => void loadDetail(j.id)}
                      >
                        <strong>{j.id}</strong>
                        <span className="body" style={{ marginLeft: 'var(--space-12)' }}>
                          {j.status} — {j.domains.join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {selectedId && detail ? (
            <section>
              <h2 className="h3">Job detail</h2>
              <pre
                className="card"
                style={{
                  overflow: 'auto',
                  maxHeight: '480px',
                  fontSize: '12px',
                  padding: 'var(--space-16)',
                }}
              >
                {JSON.stringify(detail, null, 2)}
              </pre>
              <p className="caption">
                SARIF:{' '}
                <a
                  href={`${apiBase()}/v1/jobs/${selectedId}/sarif`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/v1/jobs/{selectedId}/sarif
                </a>
              </p>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
