# CI

## Dimensions

- OS: Linux, Mac, Windows
- CPU:
  - Intel (64 bit)
  - Arm (64 bit)
- Additional Targets
  - Windows Intel 32
  - Linux Intel 32
  - WASM
- Engines
  - V8. Runtime: Node, Deno. Browsers: Chrome
  - JavaScriptCode. Runtime: Bun. Browsers: Safari
  - SpiderMonkey. Browsers: Firefox

## Runners

- MacOS Intel: 64
- MacOS ARM: 64
- Linux Intel: 64, 32
- Linux ARM: 64
- Windows Intel: 64, 32
- Windows ARM: 64

## Languages

- Rust
- FJS < JS < TS
  - FJS:
    - engines: V8 (coverage on Node), JavaScriptCore (testing on Bun), SpiderMonkey (testing)
  - JS (testing effects):
    - OS: Linux, MacOs, Windows
    - testing on runtimes: Node, Deno, Bun.
  - TS:
    - `tsc`

## Proposal

- MacOS Intel:
  - Rust: 64
- MacOS ARM:
  - Rust: 64
  - JS: testing: Node, Deno, Bun
- Linux Intel:
  - Rust: 64, 32
  - FJS:
    - coverage: Node (using native runner, because we don't have coverage support in `fjs t`)
    - testing: Bun (using our runner), SpiderMonkey (using our runner)
- Linux ARM: 64
  - Rust: 64, WASM
  - JS: testing: Node, Deno, Bun
  - TS: `tsc`
- Windows Intel:
  - Rust: 64, 32
- Windows ARM:
  - Rust: 64
  - JS: testing: Node, Deno, Bun

All JS testing are using runtime-native runners.

## Missing

- installed `fjs` runner.
- NPM package runner.

We plan to remove the `fjs` runner and NPM package check from CI until we have a better solution. We should create a TODO for that. We may have a separate pipeline to check NPM package in another repository with installation from `main`.
