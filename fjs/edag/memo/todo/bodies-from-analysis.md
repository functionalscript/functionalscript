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
value's body. But `memo` only ever runs `identityAnalysis`, which merges
nothing: every entry is exactly one original node object, which `table` holds
in its `visited: Map<Exp, index>` and already enumerates for
`sharedByIdentity`. The rebuilt `Exp` is a structural copy of a node the
analysis was handed, and the module's own doc says a function value should
hold "its body's nodes as the graph has them".

### Proposal

`identityAnalysis` answers the original node per index alongside the table —
`exps: readonly ExpOp[]`, one line next to `sharedByIdentity`, typed as the
identity analysis's own field. `evaluate` reads
`expression: v => isArray(v) ? a.exps[v[1]] : v`, and the four restorers and
the per-call `reduce` go. The body a function value carries is then the
graph's node, not its copy.

### Tasks

- [ ] `exps` on the identity analysis, with proof.
- [ ] `memo` reads it; `expression`, `codeItems`, `codeStep` and `codeNode`
      go.

### Related

- [analyse-body-per-call](./analyse-body-per-call.md) — the analysis itself
  is rebuilt per call; this is the walk back, on top of it.
- [step-traversal-owner](../../todo/step-traversal-owner.md) —
  `codeStep`/`codeItems` are among the copies it counts.
