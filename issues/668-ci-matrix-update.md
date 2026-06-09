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
  - native target checks: `cargo test` and `cargo clippy -- -D warnings`;
  - 32-bit target checks only on Intel jobs: `cargo test --target ...` and
    `cargo clippy --target ... -- -D warnings`.
- Node 26:
  - `npm install -g functionalscript@{fs.version}`  
  - `fjs t`

`fjs t` exercises FunctionalScript proof discovery, module loading, and
filesystem traversal on each OS/path format. Native `node --test` runs in the
dedicated Node 24 and Node 26 jobs instead of the platform matrix.

### Canonical Ubuntu ARM Jobs

The first iteration may use native GitHub runner images. Later iterations may use Docker or Nix to cache a heavier toolchain setup if install time or external tool download reliability becomes the main bottleneck.

- Playwright (one job).
- WASM (one job, Rust-based):
  - `cargo fmt -- --check` once, because formatting is source-wide and target-independent;
  - for each WASM target, run the target check group: `cargo test --target ...`
    and `cargo clippy --target ... -- -D warnings`;
  - `wasmer`,
  - `wasmtime`.
- Deno (one job):
  - `deno run -A npm:functionalscript@${fs.version} t`,
  - `deno test -A && deno coverage --include='.*module\\.f\\.ts'`.
- Bun (one job):
  - `bunx functionalscript@${fs.version} t`,
  - `bun test --coverage`.
- Node:
  - 22 (one job, for environments that cannot yet use Node 24+, including OpenAI Codex. Note, we can't use `node --test --experimental-strip-types` because Node22 doesn't support subtests properly):
    - `fjs t`
  - 24 (one job):
    - `node --test`.
  - 26 (one job):
    - `npx tsc`,
    - `tsgo`,
    - `node --test ...coverage...`,
    - `npm publish --dry-run`.

Total: 13 jobs.

## Decisions

- Keep the Rust canonical job named **WASM**. It owns the WASM target matrix and
  runtime setup (`wasmer`/`wasmtime`); `cargo fmt -- --check` lives there only
  because it is target-independent and should run exactly once rather than in
  every platform job.
- Treat `cargo test` and `cargo clippy` as the Rust target-check group. Clippy
  analyzes the target-specific compile surface, including `cfg(...)`
  differences, so each native, 32-bit, and WASM target that gets `cargo test`
  also gets the matching `cargo clippy` invocation for that same target.

## Related

- [i668-ci-package-aware-extras](./668-ci-package-aware-extras.md) — make Deno,
  Bun, and Playwright jobs package-aware.
- [i667-ci-self-test-script](./667-ci-self-test-script.md) — replace
  FunctionalScript-specific self-test commands with a package script convention.
