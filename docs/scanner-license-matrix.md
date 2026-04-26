# Scanner and data-source license matrix

| Component                           | Location / use          | License notes                                      |
| ----------------------------------- | ----------------------- | -------------------------------------------------- |
| Spear Aegros product code           | This repository         | Proprietary — see LICENSE                          |
| `crt.sh` (Certificate Transparency) | Passive subdomain hints | Public HTTP API — respect rate limits and ToS      |
| Node.js `dns` / `fetch`             | DNS and HTTP probes     | Runtime standard library / undici                  |
| Docker sidecar stub                 | `docker/scanner`        | MIT-style minimal stub; replace with vetted tools  |
| Future: nuclei, nmap, etc.          | Optional sidecar only   | **Must** comply with each tool’s license and scope |

Before shipping aggressive templates or commercial scanners, record vendor approval, redistribution rights, and customer authorization in your engagement pack.
