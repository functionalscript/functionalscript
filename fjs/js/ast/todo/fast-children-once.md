## One `children` for FAST; the walkers fold over it

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) owns the value-level operand table once, as
`operatorOperands`, but the block and statement half of "what are this node's
children" is re-spelled by every pass that walks FAST. The same two
expressions appear, near-verbatim, in `hasLoopTransfer`, `blockTasks` and
`freeBindings` in [`control`](../control/module.f.mjs), `_hasReturn` in
[`memo/cells`](../memo/cells/module.f.mjs), `ownsMemo` in
[`memo`](../memo/module.f.mjs), `references` in
[`sugar`](../sugar/module.f.mjs), `facts` in
[`prepare`](../prepare/module.f.mjs), `definitions` in
[`fjs/compiler/graph`](../../../compiler/graph/module.f.mjs), `children` in
[`fjs/edag/from_fast`](../../../edag/from_fast/module.f.mjs) and once more in
its `loop/root`:

```js
// hasLoopTransfer
children = node[0] === 'ref' ? [] : node[0] === 'function' ? node[1].captures.map(capture => capture.value)
    : node[0] === 'block' ? [node[1]] : node[0] === 'if' ? [node[1], node[2], node[3]] : operatorOperands(node)
…
children = [...node.statements.flatMap(statement => statement[0] === 'define' ? [statement[2]]
    : statement[0] === 'loop' ? [...statement[1].initial, statement[1].body]
    : statement[0] === 'block' ? [statement[2]] : [statement[2], statement[3], statement[4]]), ...exitValues(exit)]
```

The prepared-FAST sibling, with its `slot`, `write`, `memo` and `while` rows,
appears twice more: `scan` in [`serializer`](../serializer/module.f.mjs) and
`children` in [`fjs/rust/serializer`](../../../rust/serializer/module.f.mjs).
`exitValues`, the exit row, already lives once in `control` and is imported by
several of these; the statement and value rows never were. The
[README](../README.md) calls `control` "one explicit-stack traversal", but
four of its sibling modules each carry their own. A new `Statement` variant
today falls silently into the `[statement[2], statement[3], statement[4]]`
default of most of them.

### Proposal

Beside `operatorOperands` and `mapOperator`, the one table and the one walk:

```ts
children: (node: Value | Block) => readonly (Value | Block)[]
declared: (statement: Statement) => readonly BindingId[]   // define → [id]; block, if → results; loop → parameters and results
nodes: (root: Value | Block) => Iterable<Value | Block>     // explicit-stack preorder over children, function bodies opaque
```

with `exitValues` moved here. `hasLoopTransfer`, `_hasReturn`, `ownsMemo`
and `references` become `some` or `flatMap` over `nodes`; `freeBindings`,
`prepare.facts`, `graph.definitions` and `from_fast.children` become
`children` plus `declared` with their per-pass tagging left in place. A
`preparedChildren` in `prepare`, where the prepared `Statement` type lives,
does the same for the two serializers as a second step.

### Tasks

- [ ] Export `children`, `declared` and `nodes`; move `exitValues`.
- [ ] Rewrite the four predicate walkers over `nodes`.
- [ ] Rewrite the five table sites over `children` and `declared`.
- [ ] `preparedChildren` for the two serializers.

### Related

- [`fjs/edag/todo/operand-classification-owner`](../../../edag/todo/operand-classification-owner.md)
  — the EDAG-level operand helpers against `operatorOperands`; values only,
  and the other side of the FAST boundary.
- [`fjs/types/todo/stack-walk-driver`](../../../types/todo/stack-walk-driver.md)
  — the `{ top, rest }` frame driver; a different loop.
