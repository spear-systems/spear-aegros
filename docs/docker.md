# Docker sidecar (Linux-only scanners)

## Goal

Optional **Linux** scanner execution for binaries or policies that do not ship as pure Node modules. The server invokes:

`docker run --rm -i --network bridge <AEGROS_SCANNER_IMAGE>`

with one JSON line on stdin per [docker-scanner](../packages/aegros-server/src/docker/docker-scanner.service.ts) contract (`aegros.scanner.v1`).

## Build the stub image

From the repository root:

```bash
docker build -t spearsystems/aegros-scanner:local -f docker/scanner/Dockerfile docker/scanner
```

Set `AEGROS_SCANNER_IMAGE=spearsystems/aegros-scanner:local` on the API host.

## macOS / Windows

Docker Desktop is required; if `docker` is missing or the daemon is down, the sidecar returns a structured error and the pipeline continues without Linux-only enrichment.

## Beta status

The bundled image is a **stub** that echoes the request. Replace the `Dockerfile` contents under change control when you add licensed scanners (see [scanner-license-matrix.md](./scanner-license-matrix.md)).

## References

- ADR: [adr/0001-storage-queue.md](./adr/0001-storage-queue.md)
