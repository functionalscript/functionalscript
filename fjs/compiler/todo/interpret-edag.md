## Interpret a compiled EDAG directly

**Priority:** P3
**Status:** open — compiler value-producing APIs use represented memo
interpretation and the AST value evaluator is retired. Public admission,
compiler callable-conversion integration and native prerequisites remain open.

The planned value contract is
[EdagValue](../../edag/todo/edag-value.md): every FJS VM uses the EDAG subset
for language values and returns `Result<EdagValue, EdagValue>`. Memo and Amnesia
now share represented operation dispatch. Integration converts explicitly at
APIs exposing `unknown`:
ordinary FJS runtime values with EDAG reflection erased. Validation at the
entry for separately supplied EDAG data and native
prerequisites remain required. Compiler and VM results maintain their
invariants by construction; they need no repeated admission pass.

**EDAG interpretation** evaluates an EDAG into represented values. **Runtime
compilation** converts those values to ordinary FJS/JS runtime values, including
function-free materialization and the callable backend/load boundary.

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

The memo executor now uses an immutable cache threaded through demanded operands.
Its [native parity checks](../../edag/memo/todo/immutable-cache.md) remain open;
this rewrite does not claim that the dependency closure compiles to native code.
Host `Map` dependencies and runtime string-key dispatch in the executor's
dependency closure also need the
[native migrations](./load-modules-without-import-effect.md#native-prerequisites).
Container representation remains open; tag dispatch must use admitted branching
and static calls. Neither migration approves new language semantics.

### Proposal

The interpreter is [`fjs/edag/memo`](../../edag/memo/module.f.mjs), using
represented [`value`](../../edag/value/types.ts) operations and the
[`analysis`](../../edag/analysis/module.f.mjs) table. The requirements below govern
its remaining entry-point and integration work, not a second interpreter for an
older function representation.

An entry accepting final EDAG supplied as immutable FJS data owns validation
of that input, including malformed tuples not emitted by the compiler. The
[total-validation invariant](../../../todo/edag-stage1-discussion.md#5-validation)
applies at that admission boundary on both Node and an AOT-compiled FJS entry
in Rust. Check shape, metadata, bindings and scopes once, retaining graph
sharing. FJS immutability already guarantees acyclicity; this entry does not
accept arbitrary host-mutated objects. `memo` consumes analyzed input; its
internal assertions are not that public boundary. Compiler-produced graphs
maintain their invariants by construction. Do not add arbitrary `unknown`
admission or cycle preflight as a prerequisite to interpreter migration.

Conceptually:

```text
source modules
  -> resolve to valid final EDAG
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
continuation, `['=>', length, slots, body]`, the ordinary call `['()', callee, args]`,
and the method call — a `.` node whose continuation is `['|()', args]`, which carries
the `this` binding.

`length` is canonical nonnegative integer metadata; zero must be positive zero.
Fixed reads use `['arg', N]` with canonical integer `0 <= N < length`, and missing
fixed values read as `undefined`. `['rest']` returns one tail array per invocation;
repeated reads and captures retain that array's identity. Module-import `['args']`
is a separate binding and is invalid in a function body. This is the implemented
contract in #2237's [parameter plan](../../../spec/todo/3120-parameters.md).

The original null-frame-only Stage 2 restriction is superseded. Creating a closure
evaluates its slots in the enclosing invocation; the body reads that
captured value through `['frame', i]` in its own invocation. The slots are an array
operand of `=>`, `[]` when nothing is captured. Fixed values
and rest arrays captured by nested functions use the same frame mechanism.

Both interpreters' represented call preparation supplies fixed/rest bindings
without host arrow factories. The approved
language limit remains 0–16. Memo renders every admitted function body through
the trusted `functionText(analysis, index): string` entry described in the
[value plan](../../edag/todo/edag-value.md#operations-and-failures). This renders
code with frame-slot names and does not execute the emitted text; callable
runtime compilation and callable/EDAG association are separate work.

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
Memo and Amnesia share represented operations, differing in how operands are
reused. Both `.` and `own` read represented own properties,
as the specification defines an access
([`fjs/edag/todo/entry.md`](../../edag/todo/entry.md)), so an
inherited property is `undefined` whatever a realm puts on a prototype.
Validation refuses, besides, an access whose index is a prohibited property
name — `constructor`, `__proto__`, every name a built-in prototype gives by
the parser's list in [`fjs/js/prototype`](../../js/prototype/module.f.js),
all but `length` — since such a graph is not one the compiler emits.

### Value-producing API integration

[`compiler/transpiler`](../transpiler/module.f.mjs) now exposes
`interpret(path)`: load each dependency once, compile each parsed module with
`unresolved`, then run memo with the complete represented dependency exports as
arguments. The existing module walk retains import ordering, missing-export
checks and source paths. This per-module boundary replaces the planned single
final-graph evaluation because a linked EDAG alone no longer identifies the
source of an initializer failure. It uses the same lowering and interpreter;
there is no AST value evaluator or third module-resolution walk.

Its successful result is the complete represented export object, or the document
for a direct JSON input. Its error channel is `ParseError | InitializationError`;
the latter has the source `path`, `metadata: null`, a diagnostic `message` and
the original represented `thrown` payload. The VM still returns
`Result<EdagValue, EdagValue>`; only the loader adds source context.

`transpile` returns an inner `Result<Denotation, string>` in the effect's success
channel. Successful materialization retains the complete ordinary export object
as `Denotation.value`. It currently uses the synchronous `toData` converter, so
a selected callable produces an output refusal. Effectful `toUnknown` can
materialize callable graphs through its JavaScript host operation; integrating
that conversion into `transpile` remains a separate step. Existing successful data results
remain unchanged. This explicitly changes the compiler API's result nesting.

For JSON/DataJS, `_transpileDefault` projects the represented default before
materialization; an unselected callable export needs no conversion. Every required
initializer still runs. Direct JSON roots remain documents and bypass both
wrapping and projection. Conversion and serialization refusals name the output
file, while initialization failures name their source file. The CLI reports
`module initialization failed`; API callers retain its represented payload.
FunctionalScript output continues to rewrite the linked EDAG without evaluation.

The shared readers now live in [`source`](../source/module.f.mjs), avoiding an
import cycle between lowering and the transpiler. Consolidating the existing two
module walks remains [separate work](./one-module-resolution-walk.md).

This TODO does not define resource budgets, deterministic stopped outcomes, iterative
host-stack hardening, or production limits. Those concerns belong to the resource
hardening TODO after the baseline interpreter exists.

### Tasks

- [x] Provide represented memo interpretation in [`../../edag/memo`](../../edag/memo/module.f.mjs).
- [x] Replace the captured mutable cache with immutable evaluation state,
      preserving sharing, lazy demand, fresh calls and capture identity.
- [x] Render every admitted function body through the shared function-text
      renderer, preserving existing canonical text and using general JavaScript
      expressions for bodies outside the source writer's round-trip subset.
      Direct and indirect conversion remain within the represented VM; checked
      admission and callable runtime compilation are separate boundaries.
- [ ] Before native self-hosting, complete the
      [native cache parity checks](../../edag/memo/todo/immutable-cache.md).
- [ ] At the entry accepting final EDAG supplied as FJS data, check the
      remaining constructible malformed shapes, metadata and bindings once
      before interpretation. Preserve sharing and reuse analysis; do not
      revalidate compiler or VM output or add host-input cycle checks.
- [x] Interpret EDAG operations directly; do not generate JavaScript from EDAG and run
      it through the host JavaScript engine.
- [x] Support `['.', object, property]` property access.
- [x] Support `['=>', length, slots, body]`, `['()', callee, args]` for an ordinary
      call, and `['.', object, property, ['|()', args]]` for a method call —
      the step supplies the `this` binding. Function bodies use fixed `['arg', N]`
      and per-invocation `['rest']`, not module-import `['args']`.
- [x] Evaluate frames in the enclosing scope and make their captured values available
      through `['frame', i]` in each body invocation. The old null-only restriction is
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
- [x] Integrate EDAG interpretation behind `transpile` and `fjs compile`,
      preserving successful data outputs and graph sharing. Interpret per module
      to retain dependency failure paths; materialize after selecting the output.
      The inner Result distinguishes conversion refusal from source failure.
- [x] Add proofs that primitive, array, object, property-access, import-resolved, and
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
- [x] Add a diamond/shared-node proof showing one shared EDAG node produces one shared
      runtime value within the relevant evaluation context.
- [x] Add multi-module integration proofs over actual parsing, lowering and
      represented interpretation, preserving data results and shared imports.
- [x] Add a CLI/API compatibility proof that the existing value-producing `transpile`
      result — the inner successful `Denotation`'s value — and the `.data.js` and
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
  callable/EDAG association; the broader default function-text contract is in
  the [parameter plan](../../../spec/todo/3120-parameters.md).
