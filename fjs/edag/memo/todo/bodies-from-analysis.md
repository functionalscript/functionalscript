## `memo` rebuilds the `Node → Exp` map that `identityAnalysis` already has

**Priority:** P3
**Status:** open

### Problem

[`fjs/edag/analysis`](../../analysis/module.f.mjs) walks an `Exp` into a
table of `Node`s, operands replaced by `['#', i]`. [`module.f.mjs`](../module.f.mjs)
then walks the whole table back — `expression`, `codeItems`, `codeStep`,
`codeNode`, a switch over every node kind — to recover an `Exp` per entry, and
does it on every `evaluate`, module and body alike:

```js
const code = nodes.reduce((prefix, node) => [...prefix, codeNode(prefix, node)], [])
// …
const run = operation({ context, operand, tail, expression: e => expression(code, e), invoke })
```

The only consumer is the `=>` case, which needs an `Exp` for the function
value's body. The correspondence it rebuilds is the analysis's own: `table`
walked the `Exp` to make the entries, and for `identityAnalysis`, which is
what the transpiler and `memo`'s own `invokeWith` run, it merges nothing, so
every entry is exactly one original node object, held in `visited: Map<Exp,
index>` and already enumerated for `sharedByIdentity`. There the rebuilt
`Exp` is a structural copy of a node the analysis was handed, where the
module's own doc says a function value should hold "its body's nodes as the
graph has them". For a merged `analysis`, which `memo` accepts too and its
proof runs, an entry stands for several original nodes and the restored
expression is the one `Exp` for them — but it is the same for every call,
and `memo` builds it again on each.

### Proposal

Every `Analysis` answers the expression per index alongside the table,
`exps: readonly ExpOp[]`: where nothing merged, the original node, one line
next to `sharedByIdentity`; where entries merged, the restored expression,
built once when the table is, by the restorers moved from `memo` into
`analysis`, which owns the correspondence they invert. `evaluate` reads
`expression: v => isArray(v) ? a.exps[v[1]] : v` whatever table it was
given, and its restorers and per-call `reduce` go. A function value's body
is then the graph's node under the identity analysis, and under a merged
one the expression built once rather than per call.

### Tasks

- [ ] `exps` on every analysis, the original node where nothing merged and
      the expression restored once otherwise, with proof.
- [ ] `memo` reads it; its `expression`, `codeItems`, `codeStep` and
      `codeNode` go, the merged case's restorers now `analysis`'s.

### Related

- [analyse-body-per-call](./analyse-body-per-call.md) — the analysis itself
  is rebuilt per call; this is the walk back, on top of it.
- [step-traversal-owner](../../todo/step-traversal-owner.md) —
  `codeStep`/`codeItems` are among the copies it counts.
