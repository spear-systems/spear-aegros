# Install from npm

This guide is for end users of the stable CLI release.

## 1) Requirements

- Node.js `>=20.19.0 <27`
- npm `>=10`

Check:

```bash
node -v
npm -v
```

## 2) Install

```bash
npm install -g @spearsystems/aegros@latest
spear-aegros --version
```

If command is not found, ensure npm global bin is on `PATH`.

## 3) Configure (guided)

```bash
spear-aegros init
```

This writes config at:

- Linux/macOS: `~/.spear-aegros/config.json`
- Windows: `%USERPROFILE%\\.spear-aegros\\config.json`

You can inspect it anytime:

```bash
spear-aegros config show
```

## 4) Use

**Default (no arguments)** opens the full **interactive** session (Ink): step-by-step inputs, live **activity log** (press `l` or `Esc` to collapse/expand), then JSON + Markdown reports on disk.

```bash
spear-aegros
# same as:
spear-aegros interactive
```

Guided readline mode (no TUI):

```bash
spear-aegros scan --guided
```

Scan with **collapsible in-terminal logs** (Claude Code–style panel) when you already have flags:

```bash
spear-aegros scan --tui --domain example.com --policy passive --ack-authorized
```

Non-TUI example (logs stream to stderr):

```bash
spear-aegros scan --domains example.com,example.org --policy standard --ack-authorized
```

JSON report to stdout (still writes files unless you only need stdout for piping):

```bash
spear-aegros scan --domain example.com --ack-authorized --json
```

### Reports later

```bash
spear-aegros reports list
spear-aegros reports show <report-id-or-path>
```

Reports default to `~/.spear-aegros/reports/` (JSON + `.md` summary). Open the files directly in an editor or use `reports show`.

Feature reference: `features.md`.

## 5) Update / remove / reinstall

Update to newest stable:

```bash
npm update -g @spearsystems/aegros
```

Remove:

```bash
npm uninstall -g @spearsystems/aegros
```

Reinstall clean:

```bash
npm uninstall -g @spearsystems/aegros
npm cache verify
npm install -g @spearsystems/aegros@latest
```

Pin exact version:

```bash
npm install -g @spearsystems/aegros@1.0.0
```

`npm` global install keeps one active version, so reinstall replaces older beta/rc versions.

## 6) Migrate from beta (`0.1.0-beta.x`)

If you previously installed beta builds (and especially if old command shims still exist), do this exactly:

```bash
npm uninstall -g @spearsystems/aegros
npm cache verify
npm install -g @spearsystems/aegros@latest
spear-aegros --version
```

Then verify no old command alias remains:

- Linux/macOS: `which aegros` should return nothing (or an intentionally removed shim)
- Windows: `where aegros` should return no active shim

Only `spear-aegros` is supported.

## 7) Helpful commands

```bash
spear-aegros doctor
spear-aegros upgrade-help
```

## 8) Legal/safe use

Run assessments only on systems you are explicitly authorized to test.
