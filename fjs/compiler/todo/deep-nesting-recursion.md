## Deep containers and functions overflow the compiler's own walks

**Priority:** P1
**Status:** open

### Problem

The explicit-stack fixes in [`../ast/module.f.mjs`](../ast/module.f.mjs)
(`refsOf`) and [`../edag/module.f.mjs`](../edag/module.f.mjs) (`lower`)
cover operator chains only. A container or a function body still recurses
once per level, before the EDAG analysis that
[stack-safety](../../edag/todo/stack-safety.md) tracks is ever reached:

- `lowerLeaf` in [`../edag/module.f.mjs`](../edag/module.f.mjs) lowers an
  `'array'` or `'object'` by mapping `lower(nodes)` over its items, and a
  function through `fn` → `scope` → `lower`.

The AST's `toDjs` evaluator has been retired. Data outputs now use the same
lowering, then EDAG memo interpretation and runtime data conversion; their
remaining depth limits belong to this lowering and the linked EDAG stack-safety
task.

At `36c8d4a`, `export default ${'['.repeat(3000)}${']'.repeat(3000)};` —
a depth the parser's `stackSafety` proof accepts — fails with
`RangeError: Maximum call stack size exceeded` in `lower` for the `.rs` and
`.edag.data.js` outputs and in `toDjs` for `.json`; a body 20,000 functions
deep fails in `lower` as well.

An access chain is the same shape one step at a time: `a.b.c` nests a `.`
node per step, and every walk that recurses into a node's base — the
fold's `refsOf`, `lower`, the writer's — recurses once per step. At
`06ad1e3`, `const a = {}; export default a.x` followed by `.x` two
thousand times fails with the same `RangeError`, on every output. An
optional chain, which the parser folds into one node with a continuation
of steps ([optional chaining](../../../spec/README.md#optional-chaining)),
holds out longer and fails the same way at five thousand: the walks over a
continuation — `after`, `continuedSteps` and `stateOf` in
[`../parser/syntax/module.f.mjs`](../parser/syntax/module.f.mjs),
`stepParts` and `stepClosed` in [`../parser/module.f.mjs`](../parser/module.f.mjs),
`lowerStep` in [`../edag/module.f.mjs`](../edag/module.f.mjs), `chainSteps`
and `lastStep` in [`../serializer/module.f.mjs`](../serializer/module.f.mjs),
and `stepOperands` in [`../../edag/analysis/module.f.mjs`](../../edag/analysis/module.f.mjs)
— each recurse once per step. No module in the repository comes within two
orders of magnitude of either depth; the input is named here so the crash
is a known limit rather than a silent one.

Where the limits stand after `9789544`, on x64 Node 26.10 with the default
stack, each depth in a fresh process: the lowering holds a nested array to
1,209 levels and an access chain to 1,969 steps, the same as `main`. The
chain cases live outside `lowerLeaf` (`guardedCall`, `stepped`) so that its
frame, paid once per level of a container and once per step of a chain, did
not grow: an earlier shape of the chain lowering, with their locals inside
that function, held the array to 1,160 and the chain to 1,842. Behind the
lowering, the memo walk holds 1,170 levels, measured in
[stack-safety](../../edag/todo/stack-safety.md#compiler-integration-baseline).

### Source conversion chains

A host JavaScript reproducer generates valid FunctionalScript source with
`'export default ' + 'String('.repeat(5000) + '1' + ')'.repeat(5000) + ';'`.
The same input with `Number` instead of `String` fails in the same way.
`compiler/transpiler`'s `parse` and `compiler/edag`'s `unresolved` succeed;
`compiler/serializer`'s `tryModuleStringify` then throws
`RangeError: Maximum call stack size exceeded` on the pinned Node 26.10.0.
The source-rendering path follows `entry` → `conversion` → `item` →
`operand` → `entry`, paying a host call-stack frame at each conversion.

The parser and lowering stack-safety proofs establish those stages' depth
support; source serialization still has its own limit. This is shared with
the existing `Number` writer, rather than a regression in that conversion.
The depth above names a failing input, not a portable maximum: the exact
threshold depends on the host stack. This corner-case crash is deferred here
under [REVIEW.md](../../../doc/REVIEW.md#deferring-a-defect); the writer's
module documentation records the limitation for callers.

### Tasks

- [ ] Give the source writer an explicit work stack for nested expressions,
      including conversion operands; preserve scope hoisting, lazy regions,
      capture names, and document order. Cover deep `Number`, `String`, and
      mixed conversion chains with source-output round trips.
- [ ] Give `lowerLeaf`'s container and function cases the explicit stack the
      operator cases already have.
- [ ] Proofs at the depth `stackSafety` in `../parser/proof.f.mjs` uses, for
      nested arrays, nested objects and nested functions, on every output.
- [ ] The same for an access chain and an optional chain: a loop or an
      explicit stack in each walk over a chain's steps named above, and
      proofs at that depth — or a refusal at a stated depth, if the limit
      is kept.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [stack-safety](../../edag/todo/stack-safety.md) — the same shape in
  `fjs/edag/analysis` and `fjs/edag/rust`, one layer further down.
