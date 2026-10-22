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
of steps ([optional chaining](../../../spec/property-access/optional-chaining/README.md)),
holds out longer and fails the same way at five thousand: the walks over a
continuation — `after`, `continuedSteps` and `stateOf` in
[`../parser/syntax/module.f.mjs`](../parser/syntax/module.f.mjs),
`stepParts` and `stepClosed` in [`../parser/module.f.mjs`](../parser/module.f.mjs),
`lowerStep` in [`../edag/module.f.mjs`](../edag/module.f.mjs), the former direct
source writer's retired `chainSteps` and `lastStep`, and `stepOperands` in
[`../../edag/analysis/module.f.mjs`](../../edag/analysis/module.f.mjs)
— each recursed once per step at that revision. No module in the repository
comes within two orders of magnitude of either depth; the input is named here so the crash
is a known limit rather than a silent one.

A comma is a node of the same kind
([spec: comma](../../../spec/operators/comma/README.md)): `comma` in
[`../edag/module.f.mjs`](../edag/module.f.mjs) lowers its operands by
mapping `lower(nodes)` over them, so a comma nested in a comma recurses once
per level, as a container does, where a group makes no node and nests
freely. At `265b4a7`, on x64 Node 26.12 with the default stack and a fresh
process for each depth, the source
`'export default ' + '('.repeat(n) + '1' + ', 1)'.repeat(n) + ';'` parses at
every depth tried, three thousand included, and `unresolved` throws
`RangeError: Maximum call stack size exceeded` in `lower` past 1,262
levels, where the same measurement holds `'['.repeat(n) + ']'.repeat(n)`
to 1,303
([#3075](https://github.com/functionalscript/functionalscript/pull/3075#discussion_r4321672500)).

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

The former direct source writer had a separate recursion defect: on pinned
Node 26.10.0, parsing and lowering
`'export default ' + 'String('.repeat(5000) + '1' + ')'.repeat(5000) + ';'`
succeeded, then `tryModuleStringify` overflowed in its
`entry` → `conversion` → `item` → `operand` walk. `Number` had the same defect.
That writer and its recursive conversion path have now been retired.

Common [`edag/to_fast`](../../edag/to_fast/README.md),
[`js/ast/prepare`](../../js/ast/prepare/README.md) and the
[prepared JavaScript serializer](../../js/ast/serializer/README.md) use explicit
work stacks. Their direct stage proofs cover 20,000-deep operator chains and
final result regions, including required definitions. These stage guarantees
do not prove the public raw-graph endpoint stack-safe: the existing
`identityAnalysis` graph admission still recurses and a 20,000-deep raw
expression can overflow before reaching common output conversion. Its owner is
[EDAG stack safety](../../edag/todo/stack-safety.md). The input/lowering depth
cases above also remain separate work; removing the target writer did not
resolve those independent boundaries.

The historical reproducer depths name failing inputs, not portable maximums.
Any end-to-end conversion-chain claim must include the input and admission
walks as well as the now stack-safe output stages.

### Tasks

- [x] Retire the recursive direct source writer. Common conversion, preparation
      and prepared JavaScript spelling use explicit work stacks, with direct
      20,000-deep stage proofs.
- [ ] Cover deep `Number`, `String`, and mixed conversion chains through the
      complete public source-output round trip once the independent raw graph
      admission walks are stack-safe.
- [ ] Reproduce the historical container, comma and function failures through
      the current AST-to-FAST and graph-construction paths, and replace remaining
      recursive walks at those owners. The former `lowerLeaf` implementation
      has been retired; its removal alone is not end-to-end depth evidence.
- [ ] Proofs at the depth `stackSafety` in `../parser/proof.f.mjs` uses, for
      nested arrays, nested objects, nested commas and nested functions, on
      every output.
- [ ] The same for an access chain and an optional chain: a loop or an
      explicit stack in each walk over a chain's steps named above, and
      proofs at that depth — or a refusal at a stated depth, if the limit
      is kept.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [stack-safety](../../edag/todo/stack-safety.md) — the same shape in
  `fjs/edag/analysis` and `fjs/edag/rust`, one layer further down.
