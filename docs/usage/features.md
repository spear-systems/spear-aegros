# Features

`@spearsystems/aegros` (RC line) is a single CLI tool focused on practical external security analysis.

## Core capabilities

- **Interactive mode by default**: `spear-aegros` opens a guided wizard.
- **Collapsible activity logs**: live scan logs with `l` / `Esc` toggle.
- **Policy modes**:
  - `passive`: DNS + HTTPS HEAD fingerprint
  - `standard`: DNS + HTTP(S) GET + header checks
  - `aggressive`: standard + extra `www` probe
- **Web fingerprinting**:
  - `Server` and `X-Powered-By`
  - common platform hints (Cloudflare, nginx, Apache, Vercel, IIS, etc.)
  - security header presence inventory
- **DNS & email intelligence**:
  - deep DNS collection (NS, SOA, CAA, CNAME, SRV, PTR, DNSSEC hints, TLSA hints)
  - provider hints from MX patterns
  - SPF, DKIM, DMARC, BIMI, MTA-STS, TLS-RPT posture checks
  - spoofing risk level + email security score (`0-100`)
  - aggressive-only AXFR attempt logging
- **Subdomain intelligence**:
  - passive chaining of crt.sh, Hackertarget, ThreatCrowd, RapidDNS, Wayback
  - aggressive prefix brute checks
  - source attribution per discovered subdomain
  - takeover signature detection with critical/high severity mapping
- **TLS and delivery intelligence**:
  - TLS protocol/cipher/certificate snapshot
  - expiry and self-signed risk findings
  - CDN/WAF provider header signal detection
- **Hosting and exposure intelligence**:
  - ASN/provider enrichment via bgpview
  - aggressive open-port probing with critical telnet detection
- **Domain and storage exposure checks**:
  - RDAP lifecycle/status extraction for expiry/pending-delete signals
  - cloud bucket variant probing for S3 and GCS exposure states
- **Typosquatting monitor (aggressive)**:
  - generated variant watchlist across typo and alternate-TLD patterns
- **Security findings**:
  - critical and high-severity findings for exploitable misconfigurations
  - missing SPF / DMARC
  - missing HSTS / CSP / framing controls
  - endpoint/server error observations
- **Report persistence**:
  - JSON report files in `~/.spear-aegros/reports/`
  - Markdown summary files beside JSON
  - index file (`index.jsonl`) for report listing/search
  - additive report foundation blocks (`summary`, `scoring`, `infrastructureMap`, `integrations`)
  - integration skip visibility when optional API keys are not configured
  - finding deduplication with merged affected assets

## Report workflows

- List saved reports: `spear-aegros reports list`
- Open a report by id/path: `spear-aegros reports show <id-or-path>`
- View most recent report quickly: `spear-aegros reports latest`
- Filter report list: `spear-aegros reports list --domain <domain> --policy <policy> --limit <n>`
- Pipe structured output: add `--json` on supported commands

## Operator safety guardrails

- Explicit authorized-use acknowledgement is required.
- Domain normalization and configurable domain limits.
- Timeout and max-domain controls in config.
