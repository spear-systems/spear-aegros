# `@spearsystems/aegros-cli`

Command-line interface for Spear Aegros (beta).

## Commands

```bash
# Health check
node dist/cli.js health --url http://127.0.0.1:3000/api

# Create scan job (stub pipeline)
node dist/cli.js jobs create -d example.com,www.example.com --url http://127.0.0.1:3000/api

# Fetch job
node dist/cli.js jobs get <uuid> --url http://127.0.0.1:3000/api
```

## `--json`

Append **`--json`** anywhere on the command line for compact JSON (CI-friendly).

## Build

```bash
npm run build -w @spearsystems/aegros-cli
```
