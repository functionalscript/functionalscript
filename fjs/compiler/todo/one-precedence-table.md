## one-precedence-table. Binary operator precedence is written in the grammar, the serializer and `ast`

**Priority:** P3
**Status:** open

### Problem

Which binary operators exist and how tightly each binds is stated three
times, and nothing ties the copies together.

The grammar in [`parser/grammar`](../parser/grammar/module.f.mjs) states
it as a layer per level — `multiplicativeTags`, `additiveTags`,
`shiftTags`, `relationalTags`, `equalityTags`, `bitwiseAndTags`,
`bitwiseXorTags`, `bitwiseOrTags`, then the lazy `logicalAndTags`,
`logicalOrTags`, `nullishTags` — and as a chain of tails in which each
tail restates every tail below it:

```js
// parser/grammar
const shiftTail = repeatFrom0([shiftOp, unary, multiplicativeTail, additiveTail])
const relationalTail = repeatFrom0([relationalOp, unary, multiplicativeTail, additiveTail, shiftTail])
…
const bitwiseOrTail = repeatFrom0([bitwiseOrOp, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail, bitwiseAndTail, bitwiseXorTail])
```

The serializer in [`serializer`](../serializer/module.f.mjs) states it
again as the list `levels` that `level`, `precedence` and
`operandGrouped` read to decide where a parenthesis is needed:

```js
// serializer levels
const levels = [['?:'], ['||', '??'], ['&&'], ['|'], ['^'], ['&'], ['===', '!=='], ['<', '<=', '>', '>='], ['<<', '>>', '>>>'], ['+', '-'], ['*', '/', '%'], ['**']]
```

And [`ast`](../ast/module.f.mjs)'s `binaryTags` lists the same operators
flat, for `isBinary`. The reader decides what `a | b ^ c` means from the
first copy, the writer decides whether `a | (b ^ c)` needs its
parentheses from the second, and a round trip is correct only while the
two agree. An operator added to one level in the grammar and another in
`levels` breaks the round trip, and no check sees it.

### Proposal

One ordered table of the eager layers, tightest first, next to
`binaryTags` in `ast`, since both consumers import `ast` already:

```ts
export const eagerLayers = [
    { mul: '*', div: '/', mod: '%' },
    { add: '+', sub: '-' },
    { left: '<<', right: '>>', unsigned: '>>>' },
    …
    { or: '|' },
] as const
```

`binaryTags` is derived from it (plus `**` and the lazy and conditional
tags), the grammar's `*Tags` records and `binaryOpTag` read it, the
eager tails are built by one fold that accumulates the tails already
built, and the serializer's `levels` is the lazy levels followed by the
table's rows reversed. The order then exists once. The `EagerTail` tuple
type the grammar exports may need a pinning `Assert<Equal<…>>` once the
tails are built by a fold rather than written out.

### Tasks

- [ ] `eagerLayers` in `ast`; `binaryTags` derived from it.
- [ ] The grammar's layer records, `binaryOpTag` and the eager tails
      from the table; its proofs pass unchanged.
- [ ] The serializer's `levels` from the table; its round-trip proofs
      pass unchanged.
- [ ] `tsc`, `fjs test`, `npm start compile`.

### Related

- [unary-tags](./unary-tags.md) — the unary half of the same table.
