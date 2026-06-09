# 668-ci-matrix-update. Update generated CI matrix

**Priority:** P3
**Status:** done

## Problem

The generated CI currently mixes platform compatibility checks with heavier
toolchain, coverage, package-manager, browser, and WASM checks in the same
OS/architecture jobs. This makes Windows and Intel jobs slower because they
download and install more tools than they need. It also makes CI less reliable:
VMs where we cannot use Docker/Nix caching, especially Windows, depend more on
external tool download availability.

## Currently

- OS x Architecture
  - Rust: `cargo t`, wasmer, wasmtime
  - JS: `npm t` (`fjs t`), `node --test`, `node --test ...coverage...`, `deno test ...`, `bun test ...`
- Node.js 24:
  - `npm t` (`fjs t`), `node --test`
- Playwright

## Proposal

Use the six-platform matrix for OS/API compatibility, and move deeper checks to
separate canonical jobs. Prefer Ubuntu ARM for Linux/Docker-style heavy jobs; use
macOS ARM only for native macOS checks.
Keep Windows and other non-Docker-friendly VMs lean by installing the minimum
tooling needed for platform compatibility.

### Platform Matrix

Dimensions: 6 jobs (`OS x Architecture`).

- OS:
  - Ubuntu,
  - macOS,
  - Windows.
- Architecture:
  - ARM,
  - Intel.

Run:

- Rust:
  - native target checks: `cargo test`, `cargo test --release`, and
    `cargo clippy -- -D warnings`;
  - 32-bit target checks only on Intel jobs: `cargo test --target ...`,
    `cargo test --target ... --release`, and
    `cargo clippy --target ... -- -D warnings`.
- Node 26:
  - `npm ci`, because each Node-based job validates the lock file before tests;
  - `npm install -g functionalscript@{config.functionalscript}`;
  - `fjs t`.

`fjs t` exercises FunctionalScript proof discovery, module loading, and
filesystem traversal on each OS/path format. Native `node --test` runs in the
dedicated Node 24 and Node 26 jobs instead of the platform matrix.

### Canonical Ubuntu ARM Jobs

The first iteration may use native GitHub runner images. Later iterations may use Docker or Nix to cache a heavier toolchain setup if install time or external tool download reliability becomes the main bottleneck.

- Playwright (one Node-based job):
  - `npm ci`,
  - browser cache/install steps,
  - browser tests.
- WASM (one job, Rust-based):
  - `cargo fmt -- --check` once, because formatting is source-wide and target-independent;
  - for each WASM target, run the target check group: `cargo test --target ...`,
    `cargo test --target ... --release`, and
    `cargo clippy --target ... -- -D warnings`;
  - `wasmer`,
  - `wasmtime`.
- Deno (one job):
  - install/cache `functionalscript@${config.functionalscript}` before checkout with `deno install -g -A npm:functionalscript@${config.functionalscript}`;
  - `deno install --frozen` to validate the lock file before tests;
  - `deno run -A npm:functionalscript@${config.functionalscript} t`,
  - `deno test --allow-read --allow-env --coverage && deno coverage --include='.*module\\.f\\.ts'`, so the non-coverage Deno test command is the shared prefix and permissions stay limited to read/env access.
- Bun (one job):
  - install/cache `functionalscript@${config.functionalscript}` before checkout with `bun install -g functionalscript@${config.functionalscript}`;
  - `bun install --frozen-lockfile` to validate the lock file before tests;
  - `bunx functionalscript@${config.functionalscript} t`,
  - `bun test --coverage`.
- Node:
  - 22 (one job, for environments that cannot yet use Node 24+, including OpenAI Codex. Note, we can't use `node --test --experimental-strip-types` because Node22 doesn't support subtests properly):
    - `npm ci`,
    - `fjs t`.
  - 24 (one job):
    - `npm ci`,
    - `node --test`.
  - 26 (one job):
    - `npm ci`,
    - `npx tsc`,
    - `tsgo`,
    - `node --test ...coverage...`,
    - `npm pack`.

Total: 13 jobs.

## Decisions

- Keep the Rust canonical job named **WASM**. It owns the WASM target matrix and
  runtime setup (`wasmer`/`wasmtime`); `cargo fmt -- --check` lives there only
  because it is target-independent and should run exactly once rather than in
  every platform job.
- Treat `cargo test`, `cargo test --release`, and `cargo clippy` as the Rust
  target-check group. Release tests catch optimization/profile-specific issues,
  and Clippy analyzes the target-specific compile surface, including `cfg(...)`
  differences. Each native, 32-bit, and WASM target that gets `cargo test` also
  gets the matching release test and `cargo clippy` invocation for that same
  target.

## Related

- [i668-ci-package-aware-extras](./668-ci-package-aware-extras.md) — make Deno,
  Bun, and Playwright jobs package-aware.
- [i667-ci-self-test-script](./667-ci-self-test-script.md) — replace
  FunctionalScript-specific self-test commands with a package script convention.
