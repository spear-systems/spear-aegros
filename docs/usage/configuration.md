# Configuration

Spear Aegros CLI config is stored in `~/.spear-aegros/config.json`.

## Keys

| Key                | Type                                | Default                   | Description                                   |
| ------------------ | ----------------------------------- | ------------------------- | --------------------------------------------- |
| `defaultPolicy`    | `passive \| standard \| aggressive` | `passive`                 | Default scan policy when not provided on CLI. |
| `outputDir`        | string                              | `~/.spear-aegros/reports` | Directory for generated JSON reports.         |
| `timeoutMs`        | number                              | `8000`                    | HTTP probe timeout in milliseconds.           |
| `maxDomains`       | number                              | `25`                      | Maximum domains processed per run.            |
| `ackAuthorizedUse` | boolean                             | `false`                   | Persistent authorized-use acknowledgement.    |

## CLI commands (overview)

| Command                         | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| _(no args)_ or `interactive`    | Wizard + Ink UI, collapsible activity log                            |
| `scan`                          | One-shot scan; add `--tui` for the same log panel without the wizard |
| `scan --guided`                 | Readline prompts instead of Ink                                      |
| `features` doc                  | See `docs/usage/features.md` for capability map                      |
| `reports list` / `reports show` | Inspect saved JSON reports                                           |
| `config …` / `doctor`           | Settings and sanity checks                                           |

## Config commands

Show config:

```bash
spear-aegros config show
```

Set values:

```bash
spear-aegros config set --default-policy standard --max-domains 50
```

Set authorized-use acknowledgement:

```bash
spear-aegros config set --ack-authorized-use true
```

Reset config:

```bash
spear-aegros config reset
```

Print path only:

```bash
spear-aegros config path
```

## Recommended defaults for teams

- Keep `defaultPolicy=passive` unless your legal/ops process allows active probing.
- Keep `ackAuthorizedUse=false` on shared machines and pass `--ack-authorized` per run.
- Commit generated reports to secure storage, not git repositories.
