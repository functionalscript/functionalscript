## Investigate Boa engine support

**Priority:** P5
**Status:** open

### Problem

[Boa](https://github.com/boa-dev/boa) implements a JavaScript engine in Rust.
Investigate whether supporting it as another FJS engine would justify the
compatibility work, effects integration and maintenance cost. Rust embedding
could also be useful for code generation without a separately installed
JavaScript runtime.

This is an investigation. The current
[generated-Rust build policy](../nanvm/lib/todo/mvp-roadmap.md) remains the
baseline: consumers build with Cargo alone using committed generated files.
Adopting Boa as a supported engine and using it in `build.rs` are separate
decisions.

### Initial findings

An exploratory run used the official Boa 0.22.0 Linux executable against FJS
[`3e08fb6ad6dbc215a44f543729332411eea0a454`](https://github.com/functionalscript/functionalscript/tree/3e08fb6ad6dbc215a44f543729332411eea0a454):

- Selected effects, runtime, parser, Rust-generation and NaNVM corpus proofs
  produced 3,871 passes and two failures. Four deep/wide parser stress cases
  and the serializer property-test group were not completed; this was not
  the full repository suite.
- Both failures were `toExponential` tie rounding, reproducible directly in
  Boa without FJS:

  ```js
  (1.25).toExponential(1) // Boa: "1.2e+0"; required: "1.3e+0"
  (-2.5).toExponential(0) // Boa: "-2e+0"; required: "-3e+0"
  ```

  The required values follow the
  [ECMAScript rounding rule](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.prototype.toexponential).
- `generateRustTests` from [`fjs/nanvm/update`](../fjs/nanvm/update/module.f.mjs)
  ran with real runtime source inputs through the existing virtual filesystem.
  All 83 emitted files matched that revision's committed files byte for byte.
  This verifies that generator path, not arbitrary FJS execution or real host IO.
- Generation took about 65 seconds in one run while another probe ran
  concurrently. Cargo compilation and Rust embedding were not measured.

The [Node host](../fjs/effects/node/module.mjs) depends on Node APIs.
Passing virtual effects tests does not supply a Boa host implementation.

### Tasks

- [ ] Recheck compatibility with a candidate Boa release, including the
      rounding reproducers and previously unfinished proofs; record remaining
      failures without weakening FJS's JavaScript semantics.
- [ ] Investigate module loading, proof execution and effects support. Use
      [`fjs/effects/node/`](../fjs/effects/node/) as the evolving effects
      contract, assess reuse of existing host code, and state any unsupported
      scope explicitly.
- [ ] Measure startup, execution, memory and maintenance costs; determine
      which platforms and CI checks supported-engine status would require.
- [ ] Separately assess Cargo embedding: verify a clean build using only the
      Rust toolchain, measure cold builds and incremental regeneration, and
      investigate container caching. Any `build.rs` integration would use a
      build dependency and must preserve the consumer's Cargo-only build.
- [ ] Record whether to adopt Boa, defer it pending upstream changes, or
      decline support, with the evidence and trade-offs.

### Related

- [JavaScript compatibility](./fjs-javascript-compatibility.md) — semantic contract.
- [SpiderMonkey host](../fjs/effects/spidermonkey/module.mjs) — an existing alternative host.
- [Native effects](./nanvm-effects-node-operations.md) — related host work to assess for reuse.
