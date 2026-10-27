**# CI**

**## Dimensions**

\- OS: Linux, Mac, Windows
\- CPU:
  - Intel (64 bit)
  - Arm (64 bit)
\- Additional Targets
  - Windows Intel 32
  - Linux Intel 32
  - WASM
\- Engines
  - V8. Runtime: Node, Deno. Browsers: Chrome
  - JavaScriptCore. Runtime: Bun. Browsers: Safari
  - SpiderMonkey. Browsers: Firefox

**## Runners**

\- MacOS Intel: 64
\- MacOS ARM: 64
\- Linux Intel: 64, 32
\- Linux ARM: 64
\- Windows Intel: 64, 32
\- Windows ARM: 64

**## Languages**

\- Rust
\- FJS < JS < TS
  - FJS:
    - engines: V8 (coverage on Node), JavaScriptCore (testing on Bun), SpiderMonkey (testing)
  - JS (testing effects):
    - OS: Linux, MacOs, Windows
    - testing on runtimes: Node, Deno, Bun.
  - TS:
    - \`tsc\`

**## Proposal**

\- MacOS Intel:
  - Rust: 64
\- MacOS ARM:
  - Rust: 64
  - JS: testing: Node, Deno, Bun
\- Linux Intel:
  - Rust: 64, 32
  - FJS:
    - coverage: Node (using native runner, because we don't have coverage support in \`npm start t\`)
    - testing: Bun (using our runner), SpiderMonkey (using our runner)
\- Linux ARM: 64
  - Rust: 64, WASM
  - JS: testing: Node, Deno, Bun
  - TS: \`tsc\`
\- Windows Intel:
  - Rust: 64, 32
\- Windows ARM:
  - Rust: 64
  - JS: testing: Node, Deno, Bun

All JS testing uses runtime-native runners.

**## Retiring**

\- installed \`fjs\` runner.
\- NPM package runner. We may still pack and release a package but we will not test it in the CI.

We plan to remove the \`fjs\` runner and NPM package check from CI until we have a better solution. We should create a TODO for that. We may have a separate pipeline to check NPM package in another repository with installation from \`main\`.

**## Related TODOs**

\- [ ] \`fjs t\` should support only \`.f.mjs\` and \`.f.js\` files.
\- [ ] three test engine runners:
  1. [X] run FJS and JS files. It's \`all.test.mjs\`
  2. [ ] run FJS files only. \`fjs-only.mjs\` ?
  3. [ ] run JS files only. \`js-only.mjs\`?
\- [ ] Create a separate repo (in a different organization) that tests an FJS package. For example, its CI can build one from Git or from NPM and test it.
