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
for arity.

This replaces this TODO's earlier positive-arity/full-`['args']` design and
its restricted writer boundary. It is a proposal, not current compiler or
EDAG support. Before implementation, record explicit approval by
`sergey-shandar` with a public approval link, as required by
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).
The request to document the design does not select the arity bound below.

**Benefits:** familiar JavaScript syntax, ordinary callable results, and a
shared representation that the compiler, writer and FJS-written evaluators
can implement without privileged function construction.

**Costs:** parameter/group disambiguation, an EDAG/API migration, and a finite
factory table. Positive-arity EDAG functions no longer expose the original
argument count within the fixed prefix. This preserves the proposed source
forms, but deliberately does not preserve the earlier hypothetical EDAG
contract that combined positive arity with the complete supplied list.

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

Generate one factory for each supported length. The beginning of the table is:

```js
const factories = [
    g => (...rest) => g([], rest),
    g => (a0, ...rest) => g([a0], rest),
    g => (a0, a1, ...rest) => g([a0, a1], rest),
    g => (a0, a1, a2, ...rest) => g([a0, a1, a2], rest),
];
```

After validating `length`, select `factories[length]` at run time. Its callback
receives `(fixed, rest)` and evaluates the body with the captured frame and
these invocation bindings. `['arg', N]` reads `fixed[N]`; `['rest']` reads
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

This removes the earlier arity/complete-argument writer obstruction for the
new nodes. It does not promise that unrelated unsupported EDAG capabilities
can be serialized. Preserve captured sharing, scope and the selected identity
profile; follow the existing [function-text contract](./serialization.md#function-text-and-serialization).
Custom `toString` and the remaining function-text questions are separate work,
not capabilities implemented by these factories.

### Bound and migration

Choose and explicitly approve a shared maximum `length` before implementation.
`16` is a candidate, not a selected language limit. Generate the table through
that bound and reject out-of-range source arities and EDAG counts explicitly;
never clamp or fall back to a zero-arity callable. The bound limits fixed
parameter count, not supplied arguments or rest-array length. Keep integer
metadata rather than encoding the current table bound into the EDAG format.

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
      an explicit maximum-arity decision.
- [ ] Extend source parameter AST, shared grammar and binding. Cover empty,
      rest-only, bare single, parenthesized fixed and fixed-plus-rest forms;
      retain correct grouping, commas, trivia, scopes and early errors.
- [ ] Implement the coordinated EDAG change: length metadata, constant
      `['arg', N]` validation and per-invocation `['rest']`. Update schema,
      lowering, analysis, operations, executor contexts and native consumers.
- [ ] Generate and share the factory table; use it for EDAG materialization.
      Keep new inputs refused until their complete execution path preserves
      length and argument bindings. Add co-located proofs for the generator
      and the generated table.
- [ ] Update source writers and migrations; remove the old complete-argument
      writer boundary for the new format and document the breaking change.
- [ ] Add source -> tokens -> AST -> EDAG -> executor/source round-trip
      proofs against native JavaScript. Cover all supported arities, unused
      parameters, omitted/explicit `undefined`/extra arguments, returning and
      forwarding rest, captured parameters, repeated rest identity and
      distinct calls/callables under each executor's profile. A standalone
      JavaScript factory test is not an FJS pipeline test.
- [ ] Add refusals for negative/fractional/out-of-bound length, nonconstant
      or out-of-range `arg` indices, `arg` at length zero, duplicate names,
      invalid bindings, misplaced/rest trailing commas, newlines before
      `=>`, and deferred default/destructuring syntax. Test the selected bound
      and its first unsupported arity.
- [ ] Run generation and repository-required checks; retry the unchanged
      [`types/range`](../../fjs/types/range/module.f.mjs) compilation candidate.
      Move implemented decisions into the current specification/EDAG docs and
      retire the completed TODO without claiming unrelated features landed.

### Related

- [Current functions](../README.md#functions) — accepted syntax today.
- [Statement-aware compilation](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
  — preserve JavaScript syntax and bindings before EDAG admission/lowering.
- [Destructuring](./2450-destructuring.md) — separate binding-pattern work.
- [Function frame](./3111-function-frame.md) — capture semantics.
- [ECMAScript arrow functions](https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-arrow-function-definitions)
  — parameter syntax, early errors and function creation.
- [ECMAScript parameter binding](https://tc39.es/ecma262/multipage/syntax-directed-operations.html#sec-runtime-semantics-iteratorbindinginitialization)
  — fixed argument values and rest-array initialization.
