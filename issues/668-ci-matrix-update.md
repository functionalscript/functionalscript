# 668-ci-matrix-update. Update generated CI matrix

**Priority:** P3
**Status:** open

## Problem

The generated CI currently mixes platform compatibility checks with heavier
toolchain, coverage, package-manager, browser, and WASM checks in the same
OS/architecture jobs. This makes Windows and Intel jobs slower because they
download and install more tools than they need.

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
  - native `cargo test`;
  - 32-bit target checks only on Intel jobs.
- Node 26:
  - `npx fjs t` (*),
  - `node --test`.

### Canonical Ubuntu ARM Jobs

These jobs may use Docker or Nix to cache the heavier toolchain setup. Decide on
the cache strategy before implementation.

- Playwright (one job).
- WASM (one job, Rust-based):
  - `wasmer`,
  - `wasmtime`.
- Deno package-manager check (one job):
  - `deno run -A npm:functionalscript t` (*),
  - `deno test -A && deno coverage --include='.*module\\.f\\.ts'`.
- Bun package-manager check (one job):
  - `bunx fjs t` (*),
  - `bun test --coverage`.
- Node:
  - 24 (one job):
    - `node --test`.
  - 26 (one job):
    - `npx tsc`,
    - `tsgo`,
    - `node --test ...coverage...`,
    - `npm publish --dry-run`.

Total: 12 jobs.

(*) Consumer-package checks use installed commands such as `npx fjs`,
`deno run npm:functionalscript`, and `bunx fjs`. The FunctionalScript repository
itself uses source-tree commands because `fjs` is not available until the package
is built/installed. This should eventually be replaced by the package self-test
script convention from [i667-ci-self-test-script](./667-ci-self-test-script.md).

## Related

- [i668-ci-package-aware-extras](./668-ci-package-aware-extras.md) — make Deno,
  Bun, and Playwright jobs package-aware.
- [i667-ci-self-test-script](./667-ci-self-test-script.md) — replace
  FunctionalScript-specific self-test commands with a package script convention.
