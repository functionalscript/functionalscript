## Named and rest parameters

**Priority:** P1
**Status:** open

### Implementation status

Fixed and rest parameters shipped: the plan in
[#2220](https://github.com/functionalscript/functionalscript/pull/2220) and
the implementation in
[#2237](https://github.com/functionalscript/functionalscript/pull/2237).
The user requested: “Implement named/required parameters as we described on
top of PR 2220. `fjs compile` should support the syntax `(a, b, c, ...x) => ...`”.
They also explicitly directed runtime construction through the pre-generated
`g => (a0, ...rest) => g([a0], rest)` factory table. This authorized the
fixed/rest implementation; it does not resolve the default-text choices below.

Parsing, binding, fixed/rest EDAG, the shared factory table, both JavaScript
executors, source output and Rust output are implemented, and the accepted
syntax is in the [specification](../README.md#functions). The JavaScript table
covers lengths 0–32; valid source and EDAG remain independent of that capacity.
The old three-element function tuple is a breaking format change: recompile
source, or migrate zero-arity function-owned `args` to `rest`, retaining module
import bindings.

**What remains:** the required shared default renderer and the callable/graph
association are not implemented. Native conversion of a factory arrow still
reveals wrapper source — at `36c8d4a`, amnesia's `vm` evaluating
`['=>', 1, null, ['arg', 0]]` gives a callable whose `String` is
`(a0, ...rest) => g([a0], rest)`. That is the P1 violation below. The
unticked tasks track it, together with the language-design approval record,
the module-import preservation proofs and the executor-capacity proofs.
No claim is made that factory construction alone satisfies this requirement.

The unchanged `fjs/types/range/module.f.mjs` compilation candidate now parses
its parameters and stops at the first statement that omits its `;`: the
`export` after `contains`. Named-parameter examples with the compiler's
current statement termination syntax compile successfully.

The remaining sections retain the design and its unfinished obligations.

### Blocking review: factory text escapes through exports

[PR #2237's review](https://github.com/functionalscript/functionalscript/pull/2237#discussion_r4097743166)
reports a P1 violation of the default-text contract. Reproduced at `32d18d87`
under both Amnesia and memo:

```js
const f = (a) => a;
export default f.toString();
// Actual: '(a0, ...rest) => g([a0], rest)'
```

Exporting `f` itself retains `f.length === 1` and `f(42) === 42`, but
`String(f)`, `String([f])`, a computed property key and `''.concat(f)` all
expose the same wrapper. This is an unresolved defect, not an accepted
limitation. The review stays open until the conversion paths are fixed.

An operations-table guard cannot cover conversions performed by a consumer
of an exported arrow. A side table associating functions with EDAGs cannot
by itself change those host conversions either. The current generated arrows
inherit native function conversion and have no renderer hook. This is also
why rejecting callable exports or replacing only the `String` operation is
not a fix.

**Proposal requiring approval:** extend each generated factory with a renderer
callback and admit only the complete fresh-arrow construction pattern:

```js
(g, render) => Object.defineProperty(
    (a0, ...rest) => g([a0], rest),
    'toString',
    { value: render },
)
```

The descriptor makes the property non-enumerable, non-writable and
non-configurable. The target must be the arrow created in that expression,
never an existing shared callable. This retains the requested fixed/rest
arrow and its native arity, but adds a second factory input and a construction
pattern that the original request did not authorize. It does not modify
`length`, generate code at run time or patch prototypes.
The renderer closes over the semantic function EDAG and invocation's captured
frame, and is invoked only for conversion. Calls, allocation identity, nested
returns and exports retain their existing behavior.

The exact source pattern and freshness guarantee must be specified and
approved under [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
before implementation. Calling `Object.defineProperty` from `.f.mjs`, hiding
it in an unapproved host helper, or treating the arity factory approval as
approval of this additional operation does not satisfy that requirement.

For the first rendering increment, propose using the existing source writer
for capture-free function graphs, retaining EDAG sharing and generated
parameter names. Rendering a captured callable still needs the explicit
[serialization decisions](./serialization.md#open-questions): code text versus
a self-contained callable, whether to include captured values, and the finite
representation of `self`. If captured values are selected, the lazy-string
requirement applies; an eager `String` built from the entire capture graph is
not that implementation. Refusal is at a genuinely unsupported conversion,
never at creation, call, return or export. This paragraph is a proposal, not
an answer to those open questions or authorization to regress supported text
conversion.

Three standalone JavaScript prototype tests passed for the proposed hook:
arity/fixed/rest/identity, direct and indirect host conversions, and creation
and calls that never demand text. They use supplied renderer callbacks; they
do not implement EDAG rendering, compiler recognition or deferred strings.

### Problem

Before this implementation, `fjs compile` accepted only empty and rest-only
arrow parameter lists. The task extends that syntax
without losing the function's observable `length` when compiling, executing
or writing its EDAG.

The previous [`=>` operation](../../fjs/edag/operations/module.f.mjs) constructs
`(...args) => ...`, whose `length` is zero. Merely lowering named parameters
to indexed reads of the existing `['args']` would therefore change results.

### Proposal

Parse fixed named parameters and an optional final rest parameter. Represent
fixed values and the rest array separately in EDAG, and instantiate real
callables through pre-generated arrow factories. No mutation, prototype
change, host helper, effect or recognized `defineProperty` pattern is needed
for arity within the table-backed evaluator's documented range. The factories
do not by themselves satisfy the default function-text contract; the rendering
mechanism must preserve supported callable behavior before these factories
replace an existing materialization path.

This replaces this TODO's earlier positive-arity/full-`['args']` design and
its restricted writer boundary. The implementation request and its scope are recorded above. The initial
executor capacity is 32, without imposing a language-level arity limit.
[function-length-limit](./function-length-limit.md) proposes replacing that
with a language limit of 16.

**Benefits:** familiar JavaScript syntax, ordinary callable results, and a
shared argument representation that the compiler, writer and FJS-written
evaluators can implement without privileged arity construction.

**Costs:** parameter/group disambiguation, an EDAG/API migration, and a finite
factory table. The table-backed evaluator cannot materialize otherwise-valid
functions beyond its table: this reduces its JavaScript execution coverage,
not the syntax the language admits. Such functions remain compilable to EDAG
and source; other backends may support them. Positive-arity EDAG functions no
longer expose the original argument count within the fixed prefix. This
preserves the proposed source forms, but deliberately does not preserve the
earlier hypothetical EDAG contract that combined positive arity with the
complete supplied list. Default text also needs an EDAG-aware conversion path;
returning a correctly callable wrapper is not sufficient for that observation.

### Parsing and binding

Accept these forms, with either existing body form:

```js
const empty = () => 0;
const all = (...args) => args;
const one = a => a;
const parenthesized = (a) => a;
const fixed = (a, b, c) => [a, b, c];
const trailing = (a, b, c,) => [a, b, c];
const mixed = (a, b, c, ...args) => [a, b, c, args];
```

Here "required parameters" means the fixed named positions, not a requirement
that callers supply them. Missing fixed arguments bind to `undefined`; extra
arguments remain permitted.

1. Extend the shared [source AST](../../fjs/fsc/parser/types.ts) to retain an
   ordered list of fixed bindings and an optional rest binding. Preserve
   source locations, blocks and explicit returns. Names are erased only after
   binding and syntax validation.
2. Extend the [parameter and parenthesis grammar](../../fjs/fsc/parser/grammar/module.f.mjs).
   Named parameters overlap the identifier/grouped-expression prefix: factor
   that shared prefix and distinguish a parameter list from a group using
   the arrow continuation. Do not add an independent token-pattern parser or
   treat arbitrary expressions as binding names. Keep the shared LL(1)
   approach and prove that the grammar builds; bare `a => ...`, `(a)`,
   `(a) => ...` and `(a + b)` need distinct correct interpretations.
3. After each fixed name, accept `)`, a comma followed by another fixed name,
   a comma followed by the final `...name`, or an ordinary trailing comma.
   After `...name`, require `)`; no following parameter, second rest, default
   initializer or trailing comma. Preserve `[no LineTerminator here]` before
   `=>`, including newlines in comments, and existing statement termination.
4. Resolve parameters with the existing scope/name rules. Reject duplicate
   bindings, including a rest name duplicating a fixed name, reserved names,
   parameter/body declaration collisions and invalid binding expressions.
   Do not expand captures or shadowing rules as a side effect of this task.

Default initializers and destructuring are separate syntax work, not part of
this first implementation. Refuse them explicitly rather than partially
interpreting them. The AST should leave room for later binding patterns.

### EDAG: fixed prefix and rest

Proposed nodes:

```js
['=>', length, frame, body]
['arg', N]
['rest']
```

`length` is finite, nonnegative integer metadata, not an expression operand.
Zero must be positive zero: reject `Object.is(length, -0)`, rather than
silently normalizing it. For this syntax it is the number of fixed parameters,
including unused ones. A rest parameter adds zero. Keep the count in canonical
function content: different lengths are observable even when the bodies and
frames match.

`['arg', N]` reads a fixed parameter. `N` must be a constant finite integer
with `0 <= N < length` and must not be negative zero; it is not an EDAG
expression. Validation checks it against the function whose invocation the
node reads. A missing supplied argument produces `undefined`.

For both metadata fields, the numeric predicate is
`Number.isInteger(value) && value >= 0 && !Object.is(value, -0)`, followed
by the owning-length bound for `N`. Compiler output uses canonical positive
zero. This restriction is on metadata only: `-0` remains a distinct, valid
ordinary value in fixed parameters, rest arrays and other expressions.

`['rest']` reads the array of arguments supplied at positions `length` and
above. Its length is `max(actualArgumentCount - length, 0)`. Evaluate it as a
read of the invocation's binding, not as a fresh slice on each occurrence.
Repeated reads return the same array; distinct calls get distinct rest arrays
under the JS-compatible identity profile. Captured outer parameters/rest use
the existing frame mechanism, not the inner function's argument context.

For `(a, b, c, ...args) => ...`, lower `a`, `b` and `c` to `['arg', 0]`,
`['arg', 1]` and `['arg', 2]`; lower `args` to `['rest']`; record `length = 3`.
Functions without a source rest binding simply have no source reference to it.
At `length = 0`, `['rest']` is the complete supplied argument array.

**New function invocation scopes have no complete-list `['args']` operation.**
For positive arity, omitted arguments and explicit `undefined` in the fixed
prefix are intentionally indistinguishable. The rest tail still distinguishes
absence from a supplied `undefined`. Code needing the exact complete argument
list uses a rest-only function, whose length is zero.

#### Module import bindings are unchanged

An unresolved module is not a function invocation. Its `['args']` remains the
ordered array of imported module export objects, as specified by the
[unresolved-module plan](../../fjs/fsc/todo/compile-modules-to-edag.md#resolve-unresolved-modules-to-one-edag).
For example, `['.', ['.', ['args'], 0], 'default']` still reads the first
import's default export. Import order, attributes, evaluation anchors and
sharing are unchanged; no synthetic function arity or factory limit is added
to module imports.

Keep `['args']` in the shared node schema for that use. Scope validation
permits it in an unresolved module's evaluation scope, but rejects it in a
new-format function's invocation scope. Conversely, `['arg', N]` and
`['rest']` require an owning function and are invalid at module scope.
After linking, no unresolved module-scoped `['args']` may remain; valid
function-local `arg`/`rest` bindings remain untouched.

A function's `frame` is evaluated in its enclosing scope; only `body` opens
the function's invocation scope. Thus a module-level closure's frame may read
import `['args']`, while a nested closure's frame may capture its parent's
`arg`/`rest`. Import substitution and reachability analysis traverse frames
in the enclosing scope, never substitute inside function bodies, and preserve
node sharing. The module plan's old function-argument examples describe the
current format; their function-owned `['args']` migrate below, not the import
binding. No module-loading protocol or replacement import opcode is proposed.

### Instantiating functions from EDAG

Write factories by hand for lengths `0` through an executor-specific limit `T`
([`fjs/types/function/length`](../../fjs/types/function/length/README.md)).
This is a materialization resource limit, not a language or EDAG arity cap.
The beginning of the table is:

```js
const factories = [
    g => (...rest) => g([], rest),
    g => (a0, ...rest) => g([a0], rest),
    g => (a0, a1, ...rest) => g([a0, a1], rest),
    g => (a0, a1, a2, ...rest) => g([a0, a1, a2], rest),
];
```

After validating the EDAG's `length`, check the executor's table coverage
before selecting `factories[length]` at run time. An uncovered length is a
valid-but-unsupported materialization, not malformed EDAG; refuse it through
the executor's existing failure contract, never clamp or substitute a callable.
The selected factory's callback receives `(fixed, rest)` and evaluates the
body with the captured frame and these invocation bindings. `['arg', N]`
reads `fixed[N]`; `['rest']` reads
`rest`. The returned arrow itself is the callable exported by the evaluator,
not a thunk returning a VM-specific description. Observable conversion and
export paths must also satisfy the default-text boundary below.

```js
const f = factories[2]((fixed, rest) => [fixed[0], fixed[1], rest]);

f.length;            // 2
f();                 // [undefined, undefined, []]
f(undefined);        // [undefined, undefined, []]
f(1);                // [1, undefined, []]
f(1, 2, undefined);   // [1, 2, [undefined]]
f(1, 2, 3, 4);        // [1, 2, [3, 4]]
```

The explicit split is the reason padding is harmless: binding missing fixed
arguments to `undefined` changes neither fixed values nor the tail starting
at `length`. The earlier forwarding form `(a0, ...rest) => g(a0, ...rest)`
works with an evaluator that splits the normalized list at `length`, but
passing `(fixed, rest)` avoids reconstructing that intermediate list.

Each factory has a statically spelled parameter list, but table selection can
use the length read dynamically from an EDAG. This does not require making
`length` an expression operand of `=>`. The table is checked-in source, never
built through runtime `eval`, `Function`, dynamic import or property mutation.
The pipeline proof compiles the table's first entries through `fjs compile`'s
parser and lowering, and executes them under both JavaScript evaluators.

Share the table through the EDAG operations used by Amnesia and the memo
executor, rather than duplicating it per VM. Native backends may initialize
their own callable representation with the same contract. Preserve each
execution profile's allocation rules and existing frame/self semantics;
where `self` is supported it denotes the final callable, not the callback
behind its factory. This proposal adds no new `self` capability.

### Source serialization boundary

Write a function of length `L` as `(a0, ..., aL_1, ...rest) => body`, with
fresh names. Render `['arg', N]` as its fixed binding and `['rest']` as its
rest binding. For zero arity, use `(...rest) => body`. Keep unused fixed
parameters: dropping one changes both `length` and the start of the tail.
Generate the parameter list directly from `L`, without consulting the executor's
factory table. Source-to-EDAG compilation and EDAG-to-source writing must not
inherit that table's limit; their own resource limits remain separate.

This removes the earlier arity/complete-argument writer obstruction for the
new nodes. It does not promise that unrelated unsupported EDAG capabilities
can be serialized. Preserve captured sharing, scope and the selected identity
profile. Callable serialization and default function conversion follow the
existing [function-text contract](./serialization.md#function-text-and-serialization);
their output contracts are not automatically identical.

### Default function text: render or refuse

EDAG-derived **default** function text is already decided, not an optional
future customization. A raw factory result's native `toString()` describes
its wrapper, such as `(a0, ...rest) => g([a0], rest)`, not the EDAG function
being executed. Returning that text from an FJS VM is a wrong successful
result even though calls and `length` agree.

Keep enough semantic association between a materialized callable and its
function EDAG (and the captured frame where the selected contract needs it)
for the shared default renderer. Every supported VM conversion path that
reaches default function text must use that operation: direct `f.toString()`,
`String(f)`, array/string conversion, property-key conversion, conversion
inside admitted host methods, and observations through returned/exported
functions. Intercepting only the explicit `String` EDAG operation is not enough.
Render the associated function graph, not the factory's or callback's graph.

**Preserve supported function creation, calls, returns and exports.** Missing
rendering support is not permission to reject a function-valued export, a
nested returned callable or a host call merely because a callable can later
be converted to text. In particular, a consumer that only calls the exported
function must not acquire a new failure. Do not replace the existing callable
path with raw factories until the semantic association/rendering mechanism
preserves that supported API and its required default-text observations.
Keep the existing implementation in place while that mechanism is developed.

The render-or-refuse rule applies to genuinely unsupported conversion cases,
not to currently supported calls/returns/exports or as a new blanket source
restriction. Those cases must fail at their established unsupported-operation
boundary, never return wrapper text, placeholder strings or a silently
host-dependent result. Handle conversions through exported functions and
admitted host methods in the mechanism itself; rejecting the export to avoid
later conversion is not an implementation option. Source/EDAG-only outputs
remain independent of materialization. JavaScript executing source outside
the FJS VM still uses its native representation under the existing exception.

Specify and prove that mechanism before exposing the new materialization path.
This TODO neither supplies that mechanism nor grants property mutation or a
new pattern instruction. The `withLength` pattern may still be unnecessary
for arity, but that conclusion alone does not discharge default rendering.

Only genuinely open choices remain with the serialization TODO: whether
`String(f)` shares the callable serializer's contract, whether it includes
captures, and how `self` is represented. Resolve the choices needed by a
supported case before implementing it; refuse genuinely unsupported conversion
cases without regressing the existing callable API. Preserve the conditional
lazy frame-rendering requirement if frame inclusion is selected. User-defined
`toString` overrides remain separate work, not a reason to defer the required
default behavior.

### Executor capacity and migration

This proposal introduces **no shared language-level maximum arity**. A finite
factory table does not protect a language guarantee or prevent a source-level
mistake, so its size does not justify rejecting otherwise-valid parameter
lists ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
Document an initial table size for the table-backed evaluators; `16` is only a
candidate for that implementation capacity, not an approved language limit.

Keep integer metadata and `arg` validation independent of table coverage.
An evaluator checks coverage only on a path that needs to materialize a host
callable. A CLI output mode that evaluates EDAG inherits this executor limit;
a source/EDAG output path must not invoke that evaluator merely to reject a
larger arity. Report resource refusal through the existing failure contract,
without adding a source-visible exception type or changing argument values.
The table does not limit supplied argument count or rest-array length. Native
backends may have different capacities; enlarging the generated table does
not change the language or the meaning or encoding of an existing EDAG.

For example, with a test table ending at length `2`,
`(a, b, c, ...rest) => [a, b, c, rest]` still parses, lowers to a length-`3`
EDAG and writes back to source with that arity. The table-backed evaluator
refuses materialization; one with a larger table executes the same graph.
This is an explicit coverage limitation, not an unbounded construction
strategy or a claim that all backends can execute every valid function.

Coordinate the format/API break across schema, compiler, analysis, operations,
executors and writers. Existing three-element function nodes have arity zero;
convert their function-owned `['args']` reads to `['rest']`, including reads
in a nested closure's frame that belongs to that function. Preserve
module-owned import `['args']`, including reads in a module-level closure's
frame. Migration visits each body in its own scope; a global tag replacement
is incorrect. Do not silently reinterpret old nodes. Positive-arity/full-`['args']`
graphs from previous design sketches have no general semantics-preserving conversion to
this contract; refuse such input rather than claim a lossless migration.

Reconcile pending design documents in this proposal, before implementation:
[stage-1 subjects 2 and 7](../../todo/edag-stage1-discussion.md#2-arguments-reference),
the [native callable plan](../../nanvm-lib/todo/callable-function-objects.md),
which also covers captured frames in Rust,
and the [function-frame plan](./3111-function-frame.md) follow this
`length` / `arg` / `rest` contract, not a count-only extension of complete
`['args']`. This addresses the
[argument-model review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094709899)
and the [remaining-plan review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095100756).
Their current-format and historical descriptions remain explicitly labeled.

Current EDAG/schema documentation and executable consumers now use the
fixed/rest format. Module-import `args` semantics remain unchanged. The
[complete-arguments alternative](./arity-complete-arguments.md), including
its candidate `withLength` length pattern, is not a prerequisite for this
proposal's arity construction. The default-text
obligation above remains regardless of which construction technique is used.

If default parameters are added later, JavaScript's `length` stops before the
first parameter with a top-level default. `['rest']` can still mean the raw
tail starting at that length; later fixed bindings and the source's named
rest binding must then be derived from it. Do not equate EDAG rest with the
source rest binding in that future case or silently admit initializers now.

### Tasks

- [ ] Record language-design approval, including the EDAG/writer change and
      separation of language validity from executor capacity. Document the
      table-backed evaluators' initial capacity without imposing a language cap.
- [x] Extend source parameter AST, shared grammar and binding. Cover empty,
      rest-only, bare single, parenthesized fixed and fixed-plus-rest forms;
      retain correct grouping, commas, trivia, scopes and early errors.
- [x] Implement the coordinated EDAG change: canonical length metadata,
      constant `['arg', N]` validation and per-invocation `['rest']`. Reject
      negative zero for both metadata fields without normalizing ordinary
      `-0` argument values. Update schema, lowering, analysis, operations,
      executor contexts and native consumers.
- [x] Generate and share the factory table; check its capacity at EDAG
      materialization, separately from syntax and EDAG validation. Keep
      unsupported new execution paths refused until they preserve length and
      bindings, without regressing existing calls/returns/exports or blocking
      source/EDAG outputs that do not use them. Add co-located proofs for the
      generator and the generated table.
- [ ] Specify callable-to-EDAG association and host-conversion coverage, and
      implement the shared default renderer before switching supported
      materialization/export paths to these factories. Preserve existing
      callable behavior; permit explicit refusal only for genuinely unsupported
      conversion cases, not as a substitute for working function exports.
- [x] Update source writers and migrations; remove the old complete-argument
      writer boundary for the new format and document the breaking change.
- [ ] Preserve unresolved-module imports through schema validation, migration
      and linking. Test ordered imports alongside fixed/rest functions, an
      imported value captured in a module-level closure's frame, a nested
      closure capturing its parent's rest, and migration of old zero-arity
      bodies. Reject function-local `args` in the new format and module-local
      `arg`/`rest`; prove linking removes only module import bindings and keeps
      function bindings, import failures and sharing intact.
- [x] Add source -> tokens -> AST -> EDAG -> executor/source round-trip
      proofs against native JavaScript. Cover all supported arities, unused
      parameters, omitted/explicit `undefined`/extra arguments, returning and
      forwarding rest, captured parameters, repeated rest identity and
      distinct calls/callables under each executor's profile. A standalone
      JavaScript factory test is not an FJS pipeline test.
- [ ] Prove direct and indirect default conversion, host-method conversion
      and returned/exported functions, including nested callables. Compare
      successful text with the selected EDAG renderer, not authored JavaScript
      text. Include `((a) => a).toString()` and distinguish it from factory text.
      Preserve call-only consumers of exported/returned functions and every
      previously supported conversion; no export-level rendering refusal.
- [x] Add validation refusals for invalid length metadata (negative,
      fractional, non-finite or negative zero), negative-zero/nonconstant/
      out-of-range `arg` indices, `arg` at length zero, duplicate names,
      invalid bindings, misplaced/rest trailing commas, newlines before `=>`,
      and deferred default/destructuring syntax. Test positive-zero metadata
      round trips and preservation of ordinary `-0` arguments. A count beyond
      a factory table is not a validation error.
- [ ] Prove the executor capacity boundary and the first uncovered arity:
      source -> EDAG -> source preserves that larger arity, the limited
      evaluator refuses materialization, and a larger table executes the same
      graph correctly. Cover CLI output paths so a source/EDAG-only output
      does not inherit an evaluator limit.
- [ ] Run generation and repository-required checks; retry the unchanged
      [`types/range`](../../fjs/types/range/module.f.mjs) compilation candidate.
      Move implemented decisions into the current specification/EDAG docs and
      retire the completed TODO without claiming unrelated features landed.

### Related

- [Current functions](../README.md#functions) — accepted syntax today.
- [Arity-cap review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094327220)
  — distinguish executor capacity from language validity.
- [Default-text review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4094801475)
  — EDAG-derived default rendering is required, not optional customization.
- [Export-preservation review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095048191)
  — require rendering without regressing supported callable exports.
- [Negative-zero review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4095048215)
  — canonical positive-zero arity and index metadata.
- [Statement-aware compilation](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
  — preserve JavaScript syntax and bindings before EDAG admission/lowering.
- [Destructuring](./2450-destructuring.md) — separate binding-pattern work.
- [Function frame](./3111-function-frame.md) — capture semantics.
- [ECMAScript arrow functions](https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-arrow-function-definitions)
  — parameter syntax, early errors and function creation.
- [ECMAScript parameter binding](https://tc39.es/ecma262/multipage/syntax-directed-operations.html#sec-runtime-semantics-iteratorbindinginitialization)
  — fixed argument values and rest-array initialization.
