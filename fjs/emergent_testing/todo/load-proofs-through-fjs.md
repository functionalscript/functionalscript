## Load proofs through FJS

**Priority:** P3
**Status:** open

### Problem

The host `import` effect makes proof discovery depend on a JavaScript module
loader. Testing compiler-supported FJS on Rust needs a loader implemented in
FJS, with the same testing logic shared across engines.

### Proposal

Use the [FJS module loader](../../fsc/todo/load-modules-without-import-effect.md)
to obtain a module's export object, then let the existing proof runner discover
and run its proofs through `sandbox`. Loading and invoking proofs remain
separate operations. Keep native JavaScript execution as an independent
semantic reference; account for the specified FJS function-text exception when
comparing results.

Start with compiler-supported fixtures. Authored `.f.mjs` is not a promise of
current compiler support, and host-specific `proof.mjs` modules still require
their host runner. Keep those tests available without treating arbitrary host
JavaScript as input to the Rust VM.

### Tasks

- [ ] Connect the shared FJS loader to proof discovery without duplicating module
      resolution, parsing or EDAG execution inside the test framework.
- [ ] Add a fixture that imports a dependency and exports proofs; verify that
      loading exposes the proofs without invoking them.
- [ ] Run successful and throwing proofs through `sandbox` and preserve existing
      expected-throw classification and failure reporting.
- [ ] Compare the fixture under native Node execution and parser-based FJS
      execution on Node; once the dependency closure is AOT-compatible, run
      the same FJS loader and proof runner compiled to Rust.
- [ ] Keep host-specific proofs on their host path and account for remaining
      `import` consumers before retiring the effect.

### Related

- [nanvm-effects-node](../../../todo/nanvm-effects-node.md) — native `sandbox`
  returns the shared result/duration contract.
- [imports-promises-realms](./imports-promises-realms.md) — existing host import
  and promise concerns; a parser-based path does not resolve those regressions.
- [workers as a sandbox](./206-workers-as-a-sandbox.md) — separate isolation work.
