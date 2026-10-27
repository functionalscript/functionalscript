## A table for the prefix operators, as the binary ones have

**Priority:** P3
**Status:** open

### Problem

Binary operators are data: [`compiler/ast`](../../ast/module.f.js) holds them
as name-to-tag records, [`grammar`](../grammar/module.f.mjs) builds its
branches from them with `opOf`, and [`syntax`](../syntax/module.f.mjs) reads
`binaryOpTag`. The four prefixes — `neg`, `bitnot`, `not`, `typeof` — have no
table, so they are spelled out wherever they are met. In `grammar`, three
rules (`unary`, `unaryOperand`, `valueBranches`) each list all four:

```js
neg: [sym('-'), unaryOperand, …],
bitnot: [sym('~'), unaryOperand, …],
not: [sym('!'), unaryOperand, …],
typeof: [sym('typeof'), unaryOperand, …],
```

with three matching branch types in `grammar/types.ts`. In `syntax`, the
mapping is a record and the membership test is two identical `||` chains:

```js
const prefixOps = { neg: '-', bitnot: '~', not: '!', typeof: 'typeof' }
// toNode and operandToNode
if (node[0] === 'neg' || node[0] === 'bitnot' || node[0] === 'not' || node[0] === 'typeof') {
```

The JS writer spells the set twice more
([precedence-from-eager-layers](../../../js/ast/todo/precedence-from-eager-layers.md)).

### Proposal

`prefixLayer = { neg: '-', bitnot: '~', not: '!', typeof: 'typeof' }` in
`compiler/ast` beside `eagerLayers`, pinned to `UnaryTag` in its `types.ts`.
The grammar builds the four branches with one `prefixBranches(operand, …)`
spread into the three rules; `syntax` replaces `prefixOps` with the table and
the two chains with one `isPrefix(tag)`; the writer reads the same table.

### Tasks

- [ ] `prefixLayer` and its type pin.
- [ ] `grammar`, `syntax` and `js/ast/serializer` over it.

### Related

- [precedence-from-eager-layers](../../../js/ast/todo/precedence-from-eager-layers.md)
  — the writer's side.
- [frame-advance](./frame-advance.md) — the counting frames, a different
  table.
