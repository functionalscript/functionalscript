# 65Z-ci-scenario-docker. Replace Ubuntu CI jobs with cached Docker images

**Priority:** P3
**Status:** open

## Problem

Ubuntu CI jobs currently install every tool (Node, Bun, Deno, Rust, Wasmtime,
Wasmer, etc.) from scratch on every run. This is slow and duplicates effort
already paid on the previous run. Additionally:

- Playwright is kept in a **separate** job on Ubuntu solely because its
  installation is expensive, fragmenting the matrix.
- The scenario tests (`./fs/emergent_testing/scenarios/run.sh`) are not run in CI at all
  because no single job has all required runners (Node, Bun, Deno, Playwright)
  at once.

## Proposal

Replace the Ubuntu jobs with Docker-container jobs that pull a pre-built,
cached image. The image is rebuilt only when a tool version changes; between
rebuilds it is pulled from the GitHub Actions cache in seconds.

### What changes

| | Today | After |
|---|---|---|
| Ubuntu (Intel + ARM) | installs tools inline each run | pulls cached Docker image |
| Playwright | separate Ubuntu job | merged into Docker Ubuntu job |
| Scenario tests | not run in CI | run inside Docker Ubuntu job |
| macOS / Windows | unchanged | unchanged (no Playwright) |

### Image contents

The Dockerfile should be **generated from `fs/ci/`** so that tool versions are
single-sourced in `fs/ci/config/module.f.ts`. The image must include everything
needed for Ubuntu CI, matching what macOS and Windows jobs install inline:

| Tool | Version source |
|------|----------------|
| Node (default) | `config.node.default` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Playwright + browsers | `config.playwright` |
| Rust toolchain | `config.actions['dtolnay/rust-toolchain']` |
| Wasmtime | `config.wasmtime` |
| Wasmer | `config.wasmer` |

`docker/Dockerfile` will be replaced by the generated one. The existing file
can serve as a reference during implementation.

### Cache key

```
linux-<arch>-node<NODE>-deno<DENO>-bun<BUN>-playwright<PW>-rust<RUST>-wasmtime<WT>-wasmer<WM>
```

Derived entirely from version constants so it self-updates on any version bump.

### Architectures

Both `ubuntu-24.04` (Intel x86-64) and `ubuntu-24.04-arm` (ARM64) run Docker
jobs — the same pair as the current Ubuntu jobs.

### What runs inside the Docker job

All tests that currently run on Ubuntu, plus:
- Playwright tests (currently a separate job)
- Scenario tests across all runners: `fjs`, `node`, `bun`, `deno`, `playwright`

## Related

- [i095](./095-ci-docker.md) — original Docker CI idea
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs (broader scope)
- i183 — scenario test infrastructure
- i65Y-scenarios-proof — scenario files converted to `export const proof`; prerequisite
