## An anchor that repeats a hoisted value

**Priority:** P2
**Status:** open

### Problem

A scope evaluates an unread `const` through its comma, `[',', [t, value]]`,
so that a failure in it is the program's (`anchoring` in
[`../../edag/module.f.mjs`](../../edag/module.f.mjs)). The lowering also
anchors nodes the scope evaluates anyway: a `const` read only through a call
inlined in the same scope, and an unread import that another import's module
reaches. Such an anchor is redundant:

```js
export default n => { const t = n + 1; const u = (() => t)(); return t * 2; };
```

`u` is unread, so the comma anchors the node its call answers, `t`, which the
value reads eagerly too.

Since the writer writes every shared node as one `const`, `t`, reached from
the anchor and from the value, is shared, and the writer refuses the comma:
`an anchor that repeats a hoisted value`. The refusal reaches `.f.js`, `.js`,
and the function text `String(f)` and the Rust output embed, which fall back
to the code-only text. `2ca692ba`, whose writer hoisted only minting nodes,
wrote the node twice, `($0)=>{const $1=$0+1;return ($0+1)*2;}`. Refused the
same way at `7de6ddd5`:

```js
export default (a, b) => { const t = b + 1; const u = (() => t)(); return [t, a && u]; };
export default (a, b) => { const t = b.x; return [t, a ? (() => { const u = (() => t)(); return 1; })() : 0]; };
```

At module level, and for an import another import's module reaches, the
compact writer refuses the comma and `_tryModuleSerialize` falls back to the
multi-export writer (`moduleOperand`), which writes the anchor as a
statement of its own:

```js
// a.f.js
export default [1].length;
// b.f.js
import a from "./a.f.js"; export default [a];
// input.f.js
import a from "./a.f.js"; import b from "./b.f.js"; export default b;
// written
const $0=[1];const $1=$0.length;const $2=[$1];export default $2;
```

The text has the same value and the same failures, and reads back without
the comma: another graph, where the writer's round trip promises the graph.
`const b = [1]; const t = b[0] + 1; const u = (() => t)(); export default t * 2;`
does the same.

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

Two directions, to investigate:

- **The writer.** An anchor whose node is already a `const` of the same
  block adds nothing: the `const` statement evaluates the node where the
  anchor would. Write the `const` and not the anchor. This is local to the
  writer and costs no walk. The text reads back without the redundant
  anchor, with the same value and failures, so the round trip would
  compare the graph read back after one rewrite, or the graph without its
  redundant anchors.
- **The front end.** Never create the redundant anchor, as tried above,
  with a design that is linear and agrees with the writer and the Rust
  printer on what is eager.

### Tasks

- [ ] Investigate and choose a direction.
- [ ] Fix it: the inputs above written, or refused with the reason the
      round trip states, proved through `fjsRoundTrip` in
      [`../../proof.f.mjs`](../../proof.f.mjs), where the refusal and the
      module text are pinned today.

### Related

- [`../module.f.mjs`](../module.f.mjs) — the refusal, `moduleOperand`,
  `_tryModuleSerialize`.
- [`../../edag/module.f.mjs`](../../edag/module.f.mjs) — `anchoring`,
  `parts`, the linker.
- [`shared-linked-comma.md`](./shared-linked-comma.md) — the multi-export
  writer's fallback for a linked comma.
- [`../../../edag/todo/operand-classification-owner.md`](../../../edag/todo/operand-classification-owner.md)
  — what is eager in a method call.
- [`../../../edag/README.md`](../../../edag/README.md) — the `,` contract:
  each operand before the result a true root, which no other operand of the
  same `,` reaches. The redundant anchor breaks it; the lowering is what
  keeps it.
- [`../../../../spec/README.md`](../../../../spec/README.md) — "A module
  whose only export is `default` is written in the same normalized form",
  which the module texts above are not.
