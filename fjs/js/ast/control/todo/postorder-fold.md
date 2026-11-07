## One memoized postorder fold over FAST

**Priority:** P3
**Status:** open

### Problem

Four passes compute a value per FAST node from the values of its children,
and each writes the same engine: an explicit work stack of `enter` and
`finish` visits, a cons list of finished results, a `known` map that
short-circuits a node already folded, and a loop that pops exactly as many
results as the node has children before calling the node's own `finish`.

- `flows` in [`fjs/js/ast/prepare`](../../prepare/module.f.mjs), over its
  `facts` table;
- `summaries` in [`fjs/edag/from_fast`](../../../../edag/from_fast/module.f.mjs),
  over its `children`;
- `walk` in [`fjs/edag/from_fast/loop/completions`](../../../../edag/from_fast/loop/completions/module.f.mjs),
  over `childrenOf`, driving `encodedBody` and `completeBlock`;
- `aggregateBody` in [`fjs/edag/from_fast/loop`](../../../../edag/from_fast/loop/module.f.mjs),
  over the blocks of `block` and `if` statements.

`flows` and `summaries` are the same loop to the variable names:

```js
// prepare: flows
if (visit[0] === 'enter') {
    const previous = known.get(visit[1][1])
    if (previous !== undefined) { results = { first: previous, tail: results }; continue }
    const own = facts(visit[1])
    work = prepend(own.children.map(node => ['enter', node]), { first: ['finish', visit[1], own], tail: work })
// from_fast: summaries
if (visit[0] === 'enter') {
    const prior = known.get(visit[1][1])
    if (prior !== undefined) { results = { first: prior, tail: results }; continue }
    const nested = children(visit[1])
    work = prepend(nested.map(node => ['enter', node]), { first: ['finish', visit[1], nested], tail: work })
```

`completions` and `loop` spell the same two-phase visit as a `children:
null` or `finish: false` flag on the frame instead of a tag. The visit type
is restated with each copy: `_Visit` and `_Flow` in
[`prepare/private.ts`](../../prepare/private.ts), `Visit` and `Summary` in
[`from_fast/private.ts`](../../../../edag/from_fast/private.ts). Only two
things differ between the four: which nodes are a node's children, and what
a node comes to once its children have. `expressionText` in
[`serializer`](../../serializer/module.f.mjs) is the same fold again, over
values only and without the memo.

[`fjs/types/stack_walk`](../../../../types/stack_walk/module.f.js) owns the
driver loop these could stand on, with `walk` and `walkFold`, but none of
the four is written over it: its frames are `enter`/`resume` shaped, and a
postorder over a children list with a memo is one layer above that, which
nobody has written once.

### Proposal

A `postorder` in [`control`](../module.f.mjs), beside `foldNodes` and
`someBlock`, the preorder walks:

```ts
postorder: <N, R>(
    children: (node: N) => readonly N[],
    finish: (node: N, parts: readonly R[]) => R,
) => (known: ReadonlyMap<NodeId, R>) => (root: N) => readonly [R, ReadonlyMap<NodeId, R>]
```

built over `stack_walk`'s `walkFold`, so the stack discipline is owned
there and the postorder discipline here. `flows` becomes `postorder(node =>
facts(node).children, (node, parts) => flow(node, facts(node), parts))`;
`summaries`, `walk` and `aggregateBody` pass their own `children` and
`finish`, and the two `private.ts` visit types go. `expressionText` can
take the memo-free form or stay as it is; the serializer's fold is shallow
and its own shape.

The memo keys on a node's identity (`node[1]`), as the two memoized copies
do today; whether `postorder` should take the key as a third parameter or
assume FAST's `[tag, id, …]` layout is the one decision this leaves open.
Once [fast-children-once](../../todo/fast-children-once.md) exports
`children` for all of FAST, the first argument of two of these calls is
that export.

### Tasks

- [ ] `postorder` in `control` over `stack_walk`, with a proof.
- [ ] `prepare`'s `flows` and `from_fast`'s `summaries` over it; delete
      `_Visit`, `_Flow`, `Visit`.
- [ ] `completions`' `walk` and `loop`'s `aggregateBody` over it.
- [ ] `tsc` and the suites under `fjs/js/ast` and `fjs/edag`.

### Related

- [`fjs/types/todo/stack-walk-driver`](../../../../types/todo/stack-walk-driver.md)
  — the frame driver this fold sits on; it lists other hand-written
  loops, none of them a postorder.
- [`fjs/js/ast/todo/fast-children-once`](../../todo/fast-children-once.md)
  — the children tables; this issue is the fold over them.
- [`fjs/types/todo/strict-cons-stack`](../../../../types/todo/strict-cons-stack.md)
  — the `{ first, tail }` cell every copy declares.
