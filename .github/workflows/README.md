# CI

## Ubuntu (Intel)

It can be replaced with Docker.

- Js:
  - Checks (Node.js 25):
    - tsc
    - tsgo
  - Node.js 20,22,24,25 (we need Node.js 22 for Codex)
    - `npm test` (`npm run test20`)
    - `npm run fst`
    - dry NPM publishing
  - Deno
    - `deno task test`
    - `deno task fst`
    - dry JSR publishing
  - Bun
    - `bun test`
    - fst
- Rust:
  - Clippy
  - Fmt
  - Test:
    - Targets: native, wasmtime, wasmer

## Windows (Intel and Arm)

- Rust
  - Test:
    - Targets: native, x86

## Mac OS (Intel and ARM)

- Rust
  - Test: native

## Ubuntu Arm

- Rus
  - Test: native
