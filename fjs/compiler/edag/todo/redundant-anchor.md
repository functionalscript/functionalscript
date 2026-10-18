## Emit no redundant anchor

**Priority:** P3
**Status:** open

### Problem

A scope evaluates an unread `const` through its comma, `[',', [t, value]]`,
so that a failure in it is the program's (`anchoring` in
[`../module.f.mjs`](../module.f.mjs)). The lowering also anchors nodes the
scope evaluates anyway: a `const` read only through a call inlined in the
same scope, and an unread import that another import's module reaches.

```js
export default n => { const t = n + 1; const u = (() => t)(); return t * 2; };
```

`u` is unread, so the comma anchors the node its call answers, `t`, which the
value reads eagerly too:
`["=>",1,[],[",",[$0,["*",$0,2]]]]` with `$0` the node `n + 1`. That breaks
the `,` contract in [`../../../edag/README.md`](../../../edag/README.md):
each operand before the result is a true root, which no other operand of
the same `,` reaches.

The writers write the graph as it is. The FunctionalScript writer writes the
anchor as the node's `const`, `($0)=>{const $1=$0+1;return $1*2;}`, which
reads back without the comma: the same value and failures, another graph.
The same holds at module level, and for imports:

```js
// a.f.js
export default [1].length;
// b.f.js
import a from "./a.f.js"; export default [a];
// input.f.js — written `const $0=[1].length;export default [$0];`
import a from "./a.f.js"; import b from "./b.f.js"; export default b;
```

### What was tried

The branch of
[#2965](https://github.com/functionalscript/functionalscript/pull/2965)
removed the redundant anchor at its source, in two designs. Adversarial
reviews found faults in each, and both were taken out of that pull request:

- **In the lowering** (`ebcb93b2`, `35d7f52c`): `anchoring` dropped an
  anchor that another operand of the comma reaches eagerly. That needs an
  eager walk of every operand. It was quadratic over many unread `const`s,
  and it disagreed with the AST on what is eager (a method call's
  arguments). Its filter for an inlined body's anchors dropped one that
  alone established a node, so a program that throws compiled to one that
  returns a value.
- **In the AST** (`1d61998b`, `27e9144d`, `de4eeb38`): an inlined call whose
  value resolves to a name was read as an alias, as `const u = t;` is, and
  the linker dropped an unread import only where another import's node
  reaches its node. Reviews found compile time doubling per level of
  nesting; a chain of alias calls costing its depth cubed (at `de4eeb38`,
  through a `const`, about 25 times `2ca692ba` at two hundred levels); the
  linker dropping a failing module when two unread imports reach each
  other; and, at `de4eeb38`, the linker 2 to 7 times slower than
  `2ca692ba` on large import graphs.

Whether a node is evaluated eagerly elsewhere is a whole-graph question:
through inlined calls, method-call arguments and imports. Answering it in
the front end takes walks the front end does not otherwise make.

### Proposal

Remove the redundant anchor from the graph, not in a writer: in the
lowering, or in a pass over the linked EDAG, with a design that is linear
and agrees with the writers on what is eager.

### Tasks

- [ ] Choose where: the lowering, the linker, or a pass over the EDAG.
- [ ] Emit no redundant anchor; prove the inputs above round-trip to the
      same graph through `fjsRoundTrip` in
      [`../../proof.f.mjs`](../../proof.f.mjs), where their text is pinned
      today.

### Related

- [`../../serializer/module.f.mjs`](../../serializer/module.f.mjs) —
  `statement`, which writes such an anchor as its node's `const`.
- [`../../../edag/todo/operand-classification-owner.md`](../../../edag/todo/operand-classification-owner.md)
  — what is eager in a method call.
