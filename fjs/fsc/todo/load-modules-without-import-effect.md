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

### Native prerequisites

The host pipeline needs semantic migrations before compiler coverage can make
it self-hosting:

- The memo executor's `slot` mutates a captured `let filled`. The
  [immutable-cache rewrite](../../edag/memo/todo/immutable-cache.md) must preserve
  sharing, laziness and per-invocation identity.
- Host `Map` dependencies also need migration: `invocation` in
  [memo](../../edag/memo/module.f.mjs) indexes cache slots, `start` and `fresh` in
  [analysis](../../edag/analysis/module.f.mjs) track visited node identities,
  and the [compiler AST helpers](../ast/module.f.mjs) construct maps for
  deduplication. Immutable use of a host `Map` does not make it admitted FJS;
  [built-in admission](../../../spec/todo/2360-built-in.md#keyed-collections)
  and the [container design](../../../todo/037-language-design-map.md) remain
  open. Replace these uses with immutable containers expressed in admitted FJS,
  or obtain an approved `Map` design before implementing language support.
- Tag dispatch also uses host-only property access:
  [operations](../../edag/operations/module.f.mjs)'s `operations[e[0]]` and
  [analysis](../../edag/analysis/module.f.mjs)'s `handlers[e[0]]` select functions
  by runtime string keys. The [property-access contract](./compile-modules-to-edag.md)
  refuses that source form. Rewrite dispatch with explicit tag comparisons and
  statically named calls using admitted FJS, such as conditional expressions.
  Keep the existing handler semantics and validation/refusal behavior; broader
  compiler coverage must not silently admit dynamic string property access.

The container representation remains implementation work. Indexed arrays are a
candidate for already numbered cache slots; identity-keyed analysis needs its
own design preserving graph sharing and cross-scope rejection. Preserve the
key comparison, replacement and iteration behavior each compiler consumer
relies on; do not substitute serialized node contents for node identity.
Audit the required dependency closure for further host-only behavior rather
than treating these known cases as an exhaustive list.

These migrations and the remaining compiler coverage belong to self-hosting;
they do not reopen the completed MVP. Node loading can use the host baseline
while they proceed. This plan does not approve new language semantics.

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
- [ ] Audit and migrate host containers in the native dependency closure,
      separately from the captured-cache rewrite. Prove equivalent lookup,
      deduplication, graph-sharing and scope-validation behavior before claiming
      native readiness; language extensions require separate design approval.
- [ ] Rewrite runtime string-key dispatch in the operations and analysis modules
      to admitted tag branching. Cover every supported tag and preserve lazy
      operand demand and scope validation in host and eventual native proofs.
- [ ] Add the host test adapter for virtual file/resolution effects and real
      `sandbox` execution. Prove that module evaluation returns the complete
      export object inside a successful `SandboxResult`, and that a module
      throwing during evaluation produces its error result rather than escaping.
- [ ] Run the loader on Node with file effects and with the in-memory adapter,
      using actual successful and throwing modules in both. Check the shared
      result/duration contract without requiring identical measured durations.
      After the native semantic prerequisites and compiler coverage are complete,
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
