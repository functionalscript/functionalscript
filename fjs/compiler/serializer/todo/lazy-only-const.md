## lazy-only-const. A value shared only inside a lazy operand has no text

**Priority:** P3
**Status:** open

### Problem

The writer refuses a graph where a `const` it must write is reached only
through lazy operands (`a const only a lazy operand reaches`): a shared
array under one arm of a conditional,

```js
['?:', c, 1, ['[]', [o, o]]] // o = ['[]', []], shared
```

The parser anchors a `const` written before the statement, so the text would
establish `o` whatever `c` decides, where the graph establishes it only when
the arm runs. Reading back gives a different graph, so the writer refuses,
and the Rust printer gives such a function no text (`None`, so
`FUNCTION_TEXT` when it is converted).

The front end anchors such a `const` itself, so no compiled module has
reached this yet: the refusal shows on hand-built graphs, and on one
module-level shape found while landing operator spelling, a node shared
through a merged parent. A related oddity, not a refusal:
`(...a) => { const x = a[0] + 1; return true ? () => x : 1; }` is written
with the anchor and the captured `const` as two statements,
`const $a0=$a[0]+1;const $a1=$a[0]+1;`, longer than the source; whether
the two are one node is unchecked.

### Proposal

Write a `const` that only one lazy operand reaches inside that operand, as
an arrow's block body or an IIFE, once the writer spells blocks in
expression position. Until then the refusal is the honest answer.

### Tasks

- [ ] Spell a `const` scoped to one lazy operand, with a round-trip proof.
- [ ] `tsc`, `fjs test`.

### Related

- [../module.f.mjs](../module.f.mjs): `eagerReach` and `statement`.
- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md): Stage 3.
