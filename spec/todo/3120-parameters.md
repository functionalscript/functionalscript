## Named and rest parameters

**Priority:** P2
**Status:** open

### Problem

`fjs compile` currently accepts empty and rest-only arrow parameter lists,
not named parameters or a named prefix followed by rest. Extend that syntax
without losing the function's observable `length` when compiling, executing
or writing its EDAG.

The current [`=>` operation](../../fjs/edag/operations/module.f.mjs) constructs
`(...args) => ...`, whose `length` is zero. Merely lowering named parameters
to indexed reads of the existing `['args']` would therefore change results.

### Proposal

Parse fixed named parameters and an optional final rest parameter. Represent
fixed values and the rest array separately in EDAG, and instantiate real
callables through pre-generated arrow factories. No mutation, prototype
change, host helper, effect or recognized `defineProperty` pattern is needed
for arity within the table-backed evaluator's documented range.

This replaces this TODO's earlier positive-arity/full-`['args']` design and
its restricted writer boundary. It is a proposal, not current compiler or
EDAG support. Before implementation, record explicit approval by
`sergey-shandar` with a public approval link, as required by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
The request to document the design does not select an evaluator table size.

**Benefits:** familiar JavaScript syntax, ordinary callable results, and a
shared representation that the compiler, writer and FJS-written evaluators
can implement without privileged function construction.

**Costs:** parameter/group disambiguation, an EDAG/API migration, and a finite
factory table. The table-backed evaluator cannot materialize otherwise-valid
functions beyond its table: this reduces its JavaScript execution coverage,
not the syntax the language admits. Such functions remain compilable to EDAG
and source; other backends may support them. Positive-arity EDAG functions no
longer expose the original argument count within the fixed prefix. This
preserves the proposed source forms, but deliberately does not preserve the
earlier hypothetical EDAG contract that combined positive arity with the
complete supplied list.

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

`length` is nonnegative integer metadata, not an expression operand. For this
syntax it is the number of fixed parameters, including unused ones. A rest
parameter adds zero. Keep the count in canonical function content: different
lengths are observable even when the bodies and frames match.

`['arg', N]` reads a fixed parameter. `N` must be a constant integer with
`0 <= N < length`; it is not an EDAG expression. Validation checks it against
the function whose invocation the node reads. A missing supplied argument
produces `undefined`.

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

**There is no complete-list `['args']` operation in the new format.** For
positive arity, omitted arguments and explicit `undefined` in the fixed
prefix are intentionally indistinguishable. The rest tail still distinguishes
absence from a supplied `undefined`. Code needing the exact complete argument
list uses a rest-only function, whose length is zero.

### Instantiating functions from EDAG

Generate factories for lengths `0` through an executor-specific limit `T`.
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
not a thunk returning a VM-specific description.

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
`length` an expression operand of `=>`. Generate source at build time, never
through runtime `eval`, `Function`, dynamic import or property mutation.
These examples use the proposed syntax; they are not claims that today's
`fjs compile` already compiles the table.

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
profile; follow the existing [function-text contract](./serialization.md#function-text-and-serialization).
Custom `toString` and the remaining function-text questions are separate work,
not capabilities implemented by these factories.

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
convert their `['args']` reads to `['rest']` in the proper owning scope. Do not
silently reinterpret old nodes. Positive-arity/full-`['args']` graphs from
previous design sketches have no general semantics-preserving conversion to
this contract; refuse such input rather than claim a lossless migration.

Update the [stage-1 design](../../todo/edag-stage1-discussion.md), the current
EDAG documentation and all consumers when the format lands. Until then,
current `['args']` semantics remain unchanged. The
[complete-arguments alternative](./arity-complete-arguments.md) and
[length-pattern alternative](./3130-function-length-pattern.md) are not
prerequisites for this proposal.

If default parameters are added later, JavaScript's `length` stops before the
first parameter with a top-level default. `['rest']` can still mean the raw
tail starting at that length; later fixed bindings and the source's named
rest binding must then be derived from it. Do not equate EDAG rest with the
source rest binding in that future case or silently admit initializers now.

### Tasks

- [ ] Record language-design approval, including the EDAG/writer change and
      separation of language validity from executor capacity. Document the
      table-backed evaluators' initial capacity without imposing a language cap.
- [ ] Extend source parameter AST, shared grammar and binding. Cover empty,
      rest-only, bare single, parenthesized fixed and fixed-plus-rest forms;
      retain correct grouping, commas, trivia, scopes and early errors.
- [ ] Implement the coordinated EDAG change: length metadata, constant
      `['arg', N]` validation and per-invocation `['rest']`. Update schema,
      lowering, analysis, operations, executor contexts and native consumers.
- [ ] Generate and share the factory table; check its capacity at EDAG
      materialization, separately from syntax and EDAG validation. Keep
      unsupported execution paths refused until they preserve length and
      bindings, without blocking source/EDAG outputs that do not use them.
      Add co-located proofs for the generator and the generated table.
- [ ] Update source writers and migrations; remove the old complete-argument
      writer boundary for the new format and document the breaking change.
- [ ] Add source -> tokens -> AST -> EDAG -> executor/source round-trip
      proofs against native JavaScript. Cover all supported arities, unused
      parameters, omitted/explicit `undefined`/extra arguments, returning and
      forwarding rest, captured parameters, repeated rest identity and
      distinct calls/callables under each executor's profile. A standalone
      JavaScript factory test is not an FJS pipeline test.
- [ ] Add validation refusals for invalid length metadata (negative,
      fractional or non-finite), nonconstant or out-of-range `arg` indices,
      `arg` at length zero, duplicate names, invalid bindings, misplaced/rest
      trailing commas, newlines before `=>`, and deferred default/destructuring
      syntax. A count beyond a factory table is not a validation error.
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
- [Statement-aware compilation](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
  — preserve JavaScript syntax and bindings before EDAG admission/lowering.
- [Destructuring](./2450-destructuring.md) — separate binding-pattern work.
- [Function frame](./3111-function-frame.md) — capture semantics.
- [ECMAScript arrow functions](https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-arrow-function-definitions)
  — parameter syntax, early errors and function creation.
- [ECMAScript parameter binding](https://tc39.es/ecma262/multipage/syntax-directed-operations.html#sec-runtime-semantics-iteratorbindinginitialization)
  — fixed argument values and rest-array initialization.
