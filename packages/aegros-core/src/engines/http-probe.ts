export interface HttpProbeResult {
  readonly url: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly server?: string;
  readonly poweredBy?: string;
  readonly contentType?: string;
  readonly headers: Record<string, string>;
  readonly tls?: { protocol?: string; authorized?: boolean };
  readonly error?: string;
}

export async function probeHttpUrl(
  url: string,
  fetchImpl: typeof fetch,
  opts?: { maxRedirects?: number },
): Promise<HttpProbeResult> {
  const maxRedirects = opts?.maxRedirects ?? 5;
  let current = url;
  const headers: Record<string, string> = {};
  let lastStatus = 0;
  let server: string | undefined;
  let poweredBy: string | undefined;
  let contentType: string | undefined;
  let redirects = 0;
  try {
    while (redirects <= maxRedirects) {
      const res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'SpearAegros/0.1 (+https://spear.systems)' },
      });
      lastStatus = res.status;
      const loc = res.headers.get('location');
      res.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      server = res.headers.get('server') ?? undefined;
      poweredBy = res.headers.get('x-powered-by') ?? undefined;
      contentType = res.headers.get('content-type') ?? undefined;
      if (res.status >= 300 && res.status < 400 && loc) {
        redirects += 1;
        current = new URL(loc, current).href;
        continue;
      }
      return {
        url,
        finalUrl: current,
        status: lastStatus,
        server,
        poweredBy,
        contentType,
        headers,
      };
    }
    return {
      url,
      finalUrl: current,
      status: lastStatus,
      server,
      poweredBy,
      contentType,
      headers,
      error: 'too_many_redirects',
    };
  } catch (e) {
    return {
      url,
      finalUrl: current,
      status: lastStatus,
      server,
      poweredBy,
      contentType,
      headers,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
