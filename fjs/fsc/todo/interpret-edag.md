## Interpret a compiled EDAG directly

**Priority:** P3
**Status:** open — host baseline memo executor implemented; public entry
validation, value-producing API integration and the immutable-cache prerequisite
for native self-hosting remain open.

**Compiler dependency:** [`compile-modules-to-edag.md`](./compile-modules-to-edag.md)
provides the linked graphs. Its initial rest-only, non-capturing Stage 2 is
historical; the interpreter follows the current fixed/rest and capture contract.

### Goal

Provide a baseline FunctionalScript interpreter for a final compiled EDAG.

Module compilation and module resolution produce one final EDAG. Executing that EDAG
is a separate concern. One execution strategy is to interpret it directly; another is
to compile it to an executable function.

This TODO establishes only the basic direct-interpreter path. Deterministic time,
memory, and hostile-depth hardening are separate work in
[`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md).

This is also the executor to reuse for the
[FJS module loader](./load-modules-without-import-effect.md) and parser-based
testing. For native self-hosting, compile this FJS interpreter to direct Rust
ahead of time along with its dependency closure. Loaded EDAG remains runtime
data; no handwritten Rust EDAG executor or native `import` effect is required.
The optional [Rust EDAG library](../../../todo/rust-edag.md) is separate,
deferred work and does not block these consumers.

The existing executor is a host baseline: `slot` captures and mutates `let filled`.
Its [immutable-cache rewrite](../../edag/memo/todo/immutable-cache.md) is required
before AOT-compiling it under the existing FJS capture semantics. Broader compiler
coverage alone does not make that captured mutation valid FJS.

### Proposal

The baseline interpreter is [`fjs/edag/memo`](../../edag/memo/module.f.mjs), using
the shared [`operations`](../../edag/operations/module.f.mjs) and
[`analysis`](../../edag/analysis/module.f.mjs) table. The requirements below govern
its remaining entry-point and integration work, not a second interpreter for an
older function representation.

The public final-EDAG entry owns validation of code supplied as data, including
graphs not emitted by the compiler. The
[total-validation invariant](../../../todo/edag-stage1-discussion.md#5-validation)
applies before interpretation on both Node and Rust. `memo` consumes analyzed
input; its internal assertions are not that public validation boundary. Complete
the entry checks below and refuse unsupported input explicitly; a native
`Function` constructor is not needed to provide this boundary.

Conceptually:

```text
source modules
  -> resolve to final EDAG
  -> validate EDAG
  -> interpret EDAG
  -> value
```

Interpret the EDAG directly. Do **not** serialize or translate the EDAG back to
JavaScript and execute that generated JavaScript through the host engine; that would
make this an indirect code-generation path rather than an EDAG interpreter. Compiling
EDAG to an executable function is a separate strategy and can be developed
independently.

The interpreter must preserve EDAG node identity. Within one evaluation context, if
the same object/array constructor node is referenced more than once, evaluate it once
and reuse the same resulting value.

Function bodies require a narrower memoization scope. Each function invocation has its
own arguments and therefore its own memo table for body nodes. Do **not** reuse a
memoized body result from one invocation in another merely because the EDAG node
identity is the same. For example, two calls to `x => [x]` with `1` and `2` must not
reuse the first call's `[1]`. Sharing of a body node remains memoized within each
individual invocation.

The interpreter supports the compiler's current forms: `.` property access with no
continuation, `['=>', length, frame, body]`, the ordinary call `['()', callee, args]`,
and the method call — a `.` node whose continuation is `['|()', args]`, which carries
the `this` binding.

`length` is canonical nonnegative integer metadata; zero must be positive zero.
Fixed reads use `['arg', N]` with canonical integer `0 <= N < length`, and missing
fixed values read as `undefined`. `['rest']` returns one tail array per invocation;
repeated reads and captures retain that array's identity. Module-import `['args']`
is a separate binding and is invalid in a function body. This is the implemented
contract in #2237's [parameter plan](../../../spec/todo/3120-parameters.md).

The original null-frame-only Stage 2 restriction is superseded. Creating a closure
evaluates its `frame` expression in the enclosing invocation; the body reads that
captured value through `['frame']` in its own invocation. The schema permits a general
frame expression, and the compiler uses `null` when no frame is needed. Fixed values
and rest arrays captured by nested functions use the same frame mechanism.

Hand-written arrow factories ([`fjs/types/function/length`](../../types/function/length/README.md))
adapt host calls to the evaluator's `(fixed, rest)` bindings, preserving declared
JavaScript `length` without runtime code generation.
The table covers every length the language admits, 0–16.
The parameter plan's default-function-text gate remains open: these callables still
expose wrapper source on native conversion. Interpreter integration must not claim
that rendering or callable/EDAG association is complete.

A function body is a separate EDAG scope. Validation before interpretation must reject
operation-node identities shared across function boundaries; otherwise a single
semantic node could produce different runtime values in different invocation contexts.
Sharing within one body remains valid and is memoized per invocation.

### The memoization table

Which nodes an invocation memoizes is not the interpreter's to discover: the
analysis in [`fjs/edag/todo/analysis.md`](../../edag/todo/analysis.md) returns
the operation nodes of the whole program in walk order, each with its
scope, and the shared indices, and the interpreter indexes its per-invocation
cache by those integers — one map for the whole code, values cached per
function: an invocation holds only the entries of its own body's scope. The
table names its operands by index, so the interpreter runs the table and never
walks the EDAG's objects.
The operations themselves are amnesia's, factored into a table both executors
share, so the interpreter differs from amnesia only in reusing a value. The
table's `.` reads an own property, `Object.getOwnPropertyDescriptor(a, key)?.value`,
as the specification defines an access and as amnesia's `own` reads today
([`fjs/edag/todo/entry.md`](../../edag/todo/entry.md)), so an
inherited property is `undefined` whatever a realm puts on a prototype.
Validation refuses, besides, an access whose index is a prohibited property
name — `constructor`, `__proto__`, every name a built-in prototype gives by
the parser's list in [`fjs/js/prototype`](../../js/prototype/module.f.mjs),
all but `length` — since such a graph is not one the compiler emits.

### Existing value-producing API integration

The preceding P2 compiler work deliberately adds the EDAG-producing path **alongside**
the current value-producing DJS transpiler/CLI. The remaining integration step is to
migrate that value-producing path to use EDAG internally:

```text
source modules
  -> final EDAG
  -> validate EDAG
  -> interpret EDAG
  -> module export object
  -> select result.default for JSON/DataJS value output
  -> existing value serialization
```

This integration must preserve the
[compile API boundary](./compile-modules-to-edag.md#existing-compile-api-boundary)
as updated by [#2129](https://github.com/functionalscript/functionalscript/pull/2129).
`transpile` returns a `Denotation` whose `value` is the complete module export
object, with named properties and `default` when present, and sharing metadata
alongside it.
The `.data.js` and `.json` outputs serialize `result.default`. A direct `.json`
root remains a document and bypasses wrapping and projection. FunctionalScript
output rewrites the linked EDAG without evaluating the module, emitting its
exports through [`../serializer`](../serializer/module.f.mjs). The contract's
error half is
[`value-refusal-names-the-output.md`](./value-refusal-names-the-output.md),
which widens the channel this paragraph holds fixed.
The separately serializable final EDAG remains a compiler artifact/API from the P2 task.

This TODO does not define resource budgets, deterministic stopped outcomes, iterative
host-stack hardening, or production limits. Those concerns belong to the resource
hardening TODO after the baseline interpreter exists.

### Tasks

- [x] Provide the baseline memo executor in [`../../edag/memo`](../../edag/memo/module.f.mjs).
- [ ] Before native self-hosting, complete the
      [immutable-cache rewrite](../../edag/memo/todo/immutable-cache.md) and its
      sharing/laziness parity checks; this does not block host-only integration.
- [ ] Complete public final-EDAG entry validation before interpretation. Existing
      analysis and `bindingError` checks do not close every validation task below.
- [x] Interpret EDAG operations directly; do not generate JavaScript from EDAG and run
      it through the host JavaScript engine.
- [x] Support `['.', object, property]` property access.
- [x] Support `['=>', length, frame, body]`, `['()', callee, args]` for an ordinary
      call, and `['.', object, property, ['|()', args]]` for a method call —
      the step supplies the `this` binding. Function bodies use fixed `['arg', N]`
      and per-invocation `['rest']`, not module-import `['args']`.
- [x] Evaluate frames in the enclosing scope and make their captured values available
      through `['frame']` in each body invocation. The old null-only restriction is
      historical; capture and fixed/rest identity proofs are in
      [`../parameters/proof.f.mjs`](../parameters/proof.f.mjs).
- [x] Memoize results by EDAG node identity within one evaluation context so shared
      constructors preserve reference identity.
- [x] Start a fresh body-node memoization context for every function invocation; do
      not reuse memoized body results across different argument contexts.
      Pinned by `body` in [`../../edag/memo/proof.f.mjs`](../../edag/memo/proof.f.mjs).
- [ ] Carry analysis's rejection of operation nodes shared across function boundaries
      into the public validation entry; keep body graphs disjoint while allowing
      sharing inside one body.
- [ ] Reject a key that is a prohibited name, by the parser's two lists, in
      `validate`. A chain carries a key at its node — `.` or `?.` — and at each
      `|.` step, and every key is classified by what follows it: a call step,
      `|()`, `|?.()` or `|!()`, the three receiver-preserving calls of
      `fjs/edag/README.md`'s Chains, puts the key under `fjs/js/prototype`'s
      `prohibitedCalls`; anything else — no continuation, or a `|.` step, whose
      value becomes the next receiver — puts it under the read rule. So
      `['.', ['{}', []], 'constructor']` is refused as a read,
      `['.', a, 'toString', ['|()', args]]` is the EDAG the compiler emits and
      the executor reads, and once the grammar spells `?.`,
      `['?.', a, 'b', ['|.', 'toString', ['|()', args]]]` is admitted while
      `['?.', a, 'b', ['|.', 'push', ['|()', args]]]` is refused at `push`, the
      `|.` step's key, and `['?.', a, 'toString', ['|!()', args]]` is admitted.
      The parser applies the same rule today on nested accesses, each access's
      key judged by whether a call follows it. No prohibited shape is emitted,
      and the executor never reads one.
- [ ] Return the interpreted value for a valid final EDAG.
- [ ] Integrate final-EDAG interpretation behind the existing value-producing DJS
      `transpile` / `fjs compile` path without changing its success result/output
      for the value outputs, `.data.js` and `.json`; the FunctionalScript
      output is the writer's, per [`../serializer`](../serializer/module.f.mjs).
      The DataJS serializer then decides sharing on the executed value: pin its
      JSON refusal on `[cfg.x, cfg.x]`, with `x: []` refused and `x: 1` written,
      as the AST proof pins it today
      ([`../../edag/todo/analysis.md`](../../edag/todo/analysis.md)).
- [ ] Add proofs that primitive, array, object, property-access, import-resolved, and
      shared-node EDAGs evaluate to the expected values.
- [x] Add Stage 2 proofs for non-capturing functions, ordinary calls, and method calls.
      Done: `agrees` in [`../../edag/memo/proof.f.mjs`](../../edag/memo/proof.f.mjs)
      runs `=>`, an ordinary `()` call and method calls through `|()` and `|?.()`
      beside amnesia.
- [ ] Whenever the optional nodes enter the interpreted subset, execute them per
      "Chains" in [`../../edag/README.md`](../../edag/README.md) — receiver state
      created by `.`/`?.` and the `|.` step, consumed by the three call steps; an
      optional node's `index` or argument operand left unevaluated on its nullish
      branch, which the proofs must observe (`a?.[k]`, `f?.(...a)`), along with the
      short-circuit of the rest of the continuation — and its one exception, `|!()`,
      which the parentheses put outside the region and which therefore runs on the
      `undefined` a short-circuit produced.
- [x] Add an invocation-scope proof such as calling `x => [x]` with `1` and `2`:
      results contain the corresponding argument and do not reuse the constructed
      array across calls, while repeated references inside one call still share.
      Done: `body` in [`../../edag/memo/proof.f.mjs`](../../edag/memo/proof.f.mjs).
- [x] Add a validation proof that an operation node reused both outside and inside a
      function body is rejected. Done: `throw` in
      [`../../edag/analysis/proof.f.mjs`](../../edag/analysis/proof.f.mjs)
      (`outsideThenInside`, `insideThenOutside`, `siblingBodies`).
- [ ] Add a diamond/shared-node proof showing one shared EDAG node produces one shared
      runtime value within the relevant evaluation context.
- [ ] Add an integration proof that a multi-module program compiled/resolved to one
      final EDAG and then interpreted produces the same final value as the current DJS
      transpiler.
- [ ] Add a CLI/API compatibility proof that the existing value-producing `transpile`
      result — the `Denotation`, value and sharing alike — and the `.data.js` and
      `.json` outputs of `fjs compile` remain unchanged after switching their
      internals to final-EDAG interpretation.
- [ ] `tsc`, `fjs test`.

### Related

- [immutable-cache](../../edag/memo/todo/immutable-cache.md) — semantic prerequisite
  for compiling the memo executor to Rust, independent of syntax coverage.
- [load-modules-without-import-effect](./load-modules-without-import-effect.md) —
  composes loading around this interpreter; does not implement a second executor.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — produces the final
  EDAG this interpreter executes while keeping the old value-producing callers in
  place until this integration lands.
- [`bound-edag-interpreter-resources.md`](./bound-edag-interpreter-resources.md) —
  adds deterministic resource and host-stack hardening after this baseline exists.
- [`associate-edag-with-functions.md`](./associate-edag-with-functions.md) — records
  callable/EDAG association; default function-text work remains open in the
  [parameter plan](../../../spec/todo/3120-parameters.md).
