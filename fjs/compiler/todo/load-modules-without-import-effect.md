## Load modules through the FJS interpreter

**Priority:** P3
**Status:** open — host/virtual loader implemented; native prerequisites and
consumer migration remain.

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

The [EdagValue proposal](../../edag/todo/edag-value.md) owns the planned
representation: loading returns a represented export object through
`Result<EdagValue, EdagValue>`, and VM invocation consumes represented values.
Callers needing ordinary FJS runtime values use the separate
[target materialization boundary](../../edag/todo/edag-value.md#compilation-and-conversion-to-unknown)
to produce `unknown` with reflection erased. Callable graphs require generated
or precompiled runtime code; loading and VM invocation keep represented values.
After migration, language throws propagate as explicit `Result` errors.
Module evaluation needs no `sandbox` capture or host test adapter.

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

`compiler/transpiler.interpret(path)` now supplies the host loader. It runs each
module initializer through memo using represented dependency exports, preserving
module identity and source paths. Its effect succeeds with the complete
`EdagValue`, and fails with either `ParseError` or an `InitializationError`
retaining the original represented `thrown` value. The core evaluator still
returns `Result<EdagValue, EdagValue>`; the loader adds source context.

### Native prerequisites

The host pipeline needs semantic migrations before compiler coverage can make
it self-hosting:

- The memo executor now threads an immutable cache through evaluation. Its
  [native parity checks](../../edag/memo/todo/immutable-cache.md) must still prove
  sharing, laziness and per-invocation identity after compilation.
- Host `Map` dependencies still need migration: the walk in
  [analysis](../../edag/analysis/module.f.mjs) tracks visited node identities
  for deduplication. Immutable use of a host `Map` does not make it admitted FJS;
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

Evaluation returns `Result<EdagValue, EdagValue>` directly. A successful result
contains the represented module export object; an initialization failure
contains its represented payload. File, resolution and parse failures keep
their existing error channels. Resource limits belong to
[interpreter hardening](./bound-edag-interpreter-resources.md).

Use the existing [virtual runner](../../effects/node/virtual/module.f.mjs) for
file and resolution effects in FunctionalScript proofs. Execute the actual
parser, linker and evaluator over those fixtures, and assert their successful
and failing results. The evaluator handles language failures as data, so these
proofs need neither precomputed sandbox results nor a new host adapter. Tests
of ordinary runtime code produced by materialization belong to that separate
target boundary.

### Tasks

- [x] Expose `compiler/transpiler.interpret` using existing lowering and memo;
      preserve source errors and represented initialization failure payloads.
- [x] Prove a dependency with a named import loads to the complete export object,
      including an exported function that is not called during loading.
- [x] Prove repeated and diamond imports preserve module/value identity, and
      malformed or unavailable modules, missing exports and cycles follow the
      existing compiler refusals.
- [ ] Audit and migrate host containers in the native dependency closure,
      separately from the captured-cache rewrite. Prove equivalent lookup,
      deduplication, graph-sharing and scope-validation behavior before claiming
      native readiness; language extensions require separate design approval.
- [ ] Rewrite runtime string-key dispatch in the operations and analysis modules
      to admitted tag branching. Cover every supported tag and preserve lazy
      operand demand and scope validation in host and eventual native proofs.
- [x] Prove the loader with virtual file/resolution effects and actual
      evaluation: success returns the complete represented export object,
      and a module throwing during initialization returns its error payload.
      Keep these cases in FunctionalScript proofs.
- [ ] Run the loader on Node with file effects and with the virtual runner,
      using actual successful and failing modules in both. Check equivalent
      represented results, failures and sharing.
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
  file and resolution effects; represented evaluation needs no sandbox capture.
- [console-program](../../../nanvm-lib/todo/console-program.md) — native embedding
  and its separate CLI entry-selection question.
