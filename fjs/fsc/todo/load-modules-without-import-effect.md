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
or handwritten Rust EDAG executor.

**Native prerequisite:** the current memo executor's `slot` mutates a captured
`let filled`. The [immutable-cache rewrite](../../edag/memo/todo/immutable-cache.md)
must preserve sharing, laziness and per-invocation identity before this executor
can be compiled as FJS. This is a semantic migration, not merely missing parser
coverage. It and the remaining compiler coverage belong to self-hosting; neither
reopens the completed MVP. Node loading can use the existing host executor while
that rewrite proceeds.

### Execution boundary

Evaluation uses a host implementation of the existing `sandbox` effect to
capture the module's export object or a language throw in `SandboxResult`,
including duration. On Node, reuse the
[common host handler](../../effects/common/module.mjs); Rust supplies the
[native handler](../../../todo/nanvm-effects-node.md). File, resolution and
parse failures keep their existing error channels. Resource limits belong to
[interpreter hardening](./bound-edag-interpreter-resources.md).

In-memory files do not make execution pure. The existing
[virtual runner](../../effects/node/virtual/module.f.mjs) implements `sandbox`
as a fixture pass-through: its thunk must return a prebuilt `SandboxResult`,
and an actual throw escapes. It cannot sandbox interpreter evaluation.

For Node integration tests with in-memory modules, add a thin host `.mjs`
adapter that combines virtual file/resolution handlers with the common host
`sandbox` handler. Run the actual evaluator through that handler, so both file
and in-memory fixtures exercise real value/throw capture. Keep the pure virtual
runner's precomputed results for fixture-based unit tests; they do not establish
loader execution parity. Handler composition belongs to the test adapter, with
parsing, linking and evaluation still owned by the shared FJS pipeline.

### Tasks

- [ ] Expose the composed loader using the existing compiler and interpreter
      entry points; reuse their validation and error contracts.
- [ ] Prove a dependency with a named import loads to the complete export object,
      including an exported function that is not called during loading.
- [ ] Prove repeated and diamond imports preserve module/value identity, and
      malformed or unavailable modules, missing exports and cycles follow the
      existing compiler refusals.
- [ ] Add the host test adapter for virtual file/resolution effects and real
      `sandbox` execution. Prove that module evaluation returns the complete
      export object inside a successful `SandboxResult`, and that a module
      throwing during evaluation produces its error result rather than escaping.
- [ ] Run the loader on Node with file effects and with the in-memory adapter,
      using actual successful and throwing modules in both. Check the shared
      result/duration contract without requiring identical measured durations.
      After the immutable-cache prerequisite and compiler coverage are complete,
      run the same fixtures through its AOT-compiled dependency closure and
      compare native results, failures and sharing with Node.
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
