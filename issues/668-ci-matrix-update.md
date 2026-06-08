# CI matrix update

## Currently

- OS x Architecture
  - Rust: `cargo t`, wasmer, wasmtime
  - JS: `npm t` (`fjs t`), `node --test`, `node --test ...coverage...`, `deno test ...`, `bun test ...`
- Node.js 24:
  - `npm t` (`fjs t`), `node --test`
- Playwright

## Proposal

### Multiplatform:

Dimensions (6 jobs - OS x Architecture):

- OS:
  - Ubuntu (Docker),
  - MacOS,
  - Windows.
- Architecture:
  - ARM,
  - Intel.

Tools to run on

- Rust (32 and 64 bit targets for Intel architecture):
  - `cargo t`.
- Node 26:
  - `npx fjs t` (*),
  - `node --test`.

### Ubuntu ARM (Docker):

- Playwright (one job).
- Rust (one job):
  - `wasmer`,
  - `wasmtime`.
- Deno (one job):
  - `deno run -A npm:functionalscript t` (*),
  - `deno test -A && deno coverage --include='.*module\\.f\\.ts'`.
- Bun (one job):
  - `bunx fjs t` (*),
  - `bun test --coverage`.
- Node:
  - 24 (one job):
    - `node --test`.
  - 26 (one job):
    - `npx tsc`,
    - `tsgo`,
    - `node --test ...coverage...`.

Total: 12 jobs.

- (*) replace with another command when we run inside FunctionalScript repo because we can't use `fjs` there.
