# 66B-dockerfile-nix-integration. Generate Dockerfile with Nix toolchain from fs/ci/module.f.ts

**Priority:** P3
**Status:** open

## Problem

`docker/Dockerfile` is hand-written, installs tools via ad-hoc `curl` scripts
with no explicit version pinning, and uses `sccache` for Rust build caching.
This makes the image hard to reproduce and disconnected from the version pins
already maintained in `fs/ci/config/module.f.ts`.

The image is also not used in CI today — each Ubuntu job re-installs tools from
scratch on every run.

## Proposal

### 1. Remove `sccache`

Drop the `cargo install sccache` step and the `RUSTC_WRAPPER=sccache` env var.
`sccache` adds an extra build layer that doesn't integrate well with our setup
and is unnecessary overhead for the current codebase size. This can be
reconsidered if the Rust compilation time grows significantly.

### 2. Replace curl-based installs with Nix

Use [Nix](https://nixos.org/) (single-user install) as the package manager
inside the image. Nix provides reproducible, content-addressed tool environments
and works on any Linux base image.

### 3. Version-pin all tools via Nix, sourced from `fs/ci/config/module.f.ts`

| Tool | Version source |
|------|----------------|
| Node (default) | `config.node.default` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Rust toolchain | `config.actions['dtolnay/rust-toolchain']` |
| Wasmtime | `config.wasmtime` |
| Wasmer | `config.wasmer` |
| Playwright + browsers | `config.playwright` |

`fs/ci/config/module.f.ts` remains the single source of truth for all version
pins across both the generated workflow YAML and the Dockerfile.

### 4. Generate `docker/Dockerfile` from `fs/ci/module.f.ts`

Mirror the pattern used for `.github/workflows/ci.yml`: add a
`writeDockerfile` export (or equivalent) to `fs/ci/module.f.ts` that renders
and writes `docker/Dockerfile` from the same config. Version bumps in
`config/module.f.ts` then propagate to both the CI workflow and the Dockerfile
in a single place.

### 5. Dedicated `docker-build` CI job with GitHub Actions cache

Add a GitHub Actions job that:

1. Computes the cache key from the version pins (same scheme as
   [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md)):
   `linux-<arch>-node<NODE>-deno<DENO>-bun<BUN>-playwright<PW>-rust<RUST>-wasmtime<WT>-wasmer<WM>`
2. Attempts to restore the image from `actions/cache`.
3. Builds the image on a cache miss.
4. Saves the image as a GitHub Actions **artifact** so downstream jobs can
   pull it without rebuilding.

### 6. Downstream jobs consume the single cached image

All Ubuntu CI jobs (`needs: docker-build`) restore the artifact, `docker load`
the image, and run their steps inside the container. One image is built once
per workflow run and shared by all jobs — including the Playwright job, which
can be merged back into the main Ubuntu matrix rather than running separately.

## Benefits

- **Reproducibility** — Nix gives content-addressed installs; curl scripts can
  silently pull different versions on different days.
- **Developer / CI parity** — developers build or pull the same image used in CI.
- **Single source of truth** — all version pins live in `config/module.f.ts`.
- **Efficiency** — one Docker build per version-pin change; all parallel jobs
  reuse the cached image.

## Tasks

- [ ] Add `writeDockerfile` to `fs/ci/module.f.ts` (and wire it into the
      existing `main`/`ci` entry-point).
- [ ] Write the Dockerfile template: Debian base → install Nix → `nix-env -i`
      each tool at the pinned version.
- [ ] Remove `sccache` install and `RUSTC_WRAPPER` env from the generated file.
- [ ] Add the `docker-build` GitHub Actions job (Intel + ARM variants) with
      cache-key computation and artifact upload.
- [ ] Update downstream Ubuntu jobs to `docker load` the artifact and run
      inside the container.
- [ ] Merge the standalone `playwright` job into the Docker Ubuntu job.
- [ ] Confirm the generated CI YAML and Dockerfile are regenerated consistently
      by `npm run ci-update` (or equivalent).

## Related

- [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md) — Docker plan for
  Ubuntu CI jobs; this issue implements it and adds the Nix layer.
- [i65Z-ci-nix](./65Z-ci-nix.md) — Nix as CI package manager; macOS/Windows
  stay with inline `setup-*` actions; Linux uses Nix-inside-Docker.
- [i145](./145-docker-linux-ci.md) — Docker containers for Linux CI jobs.
- [i095](./095-ci-docker.md) — original Docker CI idea.
- [i096](./096-ci-caching.md) — CI caching.
