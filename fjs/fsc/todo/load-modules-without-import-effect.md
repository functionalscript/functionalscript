## Load modules through the FJS interpreter

**Priority:** P3
**Status:** open

### Problem

Loading a FunctionalScript module should use the same parser, module resolution,
linker and interpreter on JavaScript hosts and native Rust. Porting the host
`import` effect to Rust would put that language logic in the effect runner and
make self-hosting depend on a second interpreter.

### Proposal

Compose the existing `ReadFile` and `ResolveFileModule` effects with the FJS
parser, AST-to-EDAG lowering, linker and validated
[FJS interpreter](./interpret-edag.md). Loading evaluates the linked module
and returns its complete export object. It does not call exported functions;
the test runner or CLI selects and invokes an entry separately.

Source-level `import` remains part of the language. This workflow needs neither
a host `import` effect nor an effect that converts EDAG into a native function.
It accepts the compiler-supported FJS subset, not arbitrary JavaScript or host
modules. Reuse the existing resolution rules and readers; the
[shared module walk](./one-module-resolution-walk.md) owns their consolidation.
Do not introduce a third resolution walk.

For the native executable, compile this FJS pipeline, including its interpreter,
to direct Rust ahead of time. At runtime the compiled interpreter evaluates
newly loaded EDAG as data. It needs no runtime Rust generation, Cargo invocation
or handwritten Rust EDAG executor. Compiler coverage needed to compile these
modules is part of the existing self-hosting work, not a new MVP acceptance gate.

Execution uses the existing `sandbox` effect to capture successful values and
language throws. File, resolution and parse failures keep their existing error
channels. Resource limits belong to
[interpreter hardening](./bound-edag-interpreter-resources.md).

### Tasks

- [ ] Expose the composed loader using the existing compiler and interpreter
      entry points; reuse their validation and error contracts.
- [ ] Prove a dependency with a named import loads to the complete export object,
      including an exported function that is not called during loading.
- [ ] Prove repeated and diamond imports preserve module/value identity, and
      malformed or unavailable modules, missing exports and cycles follow the
      existing compiler refusals.
- [ ] Run the loader on Node with file effects and with in-memory effects. Once
      its dependency closure compiles to Rust, run the same fixtures natively
      and compare results and failures.
- [ ] Migrate FJS consumers of the host `import` effect, beginning with the
      [proof loader](../../emergent_testing/todo/load-proofs-through-fjs.md).
      Account for host-only consumers before proposing removal of the existing
      effect; it remains implemented during migration.

### Related

- [interpret-edag](./interpret-edag.md) — owns the executor and public validation.
- [compile-modules-to-edag](./compile-modules-to-edag.md) — owns linked graphs.
- [nanvm-effects-node](../../../todo/nanvm-effects-node.md) — low-level native
  effects, including `sandbox`.
- [console-program](../../../nanvm-lib/todo/console-program.md) — native embedding
  and its separate CLI entry-selection question.
