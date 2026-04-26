# `@spearsystems/aegros-core`

Shared **TypeScript** library for Spear Aegros: job types, domain normalization, pipeline stage names, report envelope (`ReportArtifactV1`), and the **`AiService`** interface.

## Public API

- **`normalizeDomainsToScope(domains)`** — trim, lowercase hostnames via URL parser, dedupe.
- **`PIPELINE_ORDER` / `PipelineStage`** — DAG stage identifiers for future workers.
- **`emptyReportV1`** — beta stub report JSON.
- **`AiService`** — implemented in the server (noop today; Ollama/Gemini/OpenAI later).

## Build

```bash
npm run build -w @spearsystems/aegros-core
```

Private workspace package; consumers install **`@spearsystems/aegros`** umbrella.
