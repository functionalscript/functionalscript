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
/** The lazy layers above them, tightest first; `??` shares a level with `||` and mixes with neither. */
export const lazyLayers = [
    { logicalAnd: '&&' },
    { logicalOr: '||', nullish: '??' },
] as const
```

The lazy operators get a table of their own because their order is
duplicated the same way: the grammar's `logicalAndTags`,
`logicalOrTags` and `nullishTags` and its `circuitTail` state it once,
and the serializer's `levels` prefix states it again. `lazyLayers` is
what both read; the rule that `??` does not mix with `&&` or `||` is
the grammar's own and stays in `circuitTail`, since it is a refusal, not
an order.

`binaryTags` stays as it is written: it is a public array whose order a
caller can enumerate, and that order is not the precedence order (`**`
follows `* / %`, equality precedes relational, shifts follow the
bitwise tags), so deriving it from the table would change it for no
gain. The table and `binaryTags` are tied the other way, by a
type-level pin beside `_BinaryTagsAreComplete` in
[`ast/types.ts`](../ast/types.ts) that the two tables' tags plus `**`
are exactly `BinaryTag` as a set, so an operator
added to one and not the other is a `tsc` error. The conditional is not
a binary operator — `AstConditional` is its own four-element node — so
`?:` is never in a table or in `binaryTags`. The grammar's
`*Tags` records and `binaryOpTag` read the tables, and the eager tails
are built by one fold that accumulates the tails already built. The
serializer's `levels` is a precedence ladder, not a tag list, so it is
the one place `?:` appears: its loosest level, then `lazyLayers`
reversed, then `eagerLayers` reversed, then `**`.

`**` is in neither table, on purpose, and this issue's scope stops at
it. It is not a layer of the same shape: the eager layers are
left-associative `repeatFrom0` tails over `unary`, while `**` is
right-associative and the grammar reads it in `powTail`, an `option`
inside the operand itself, so a table of tails cannot hold it. Its
place, tightest of all, is the language's and is stated where each side
builds its own structure — `powTail` in the grammar, the last level in
the serializer — and the set pin covers its tag, so it cannot be
dropped from one side without a `tsc` error; only its position stays
written twice. The order of every left-associative binary operator then
exists once.
The `EagerTail` tuple type the grammar exports may need a pinning
`Assert<Equal<…>>` once the tails are built by a fold rather than
written out.

### Tasks

- [ ] `eagerLayers` and `lazyLayers` in `ast`; the set pin between
      them and `BinaryTag`; `binaryTags` unchanged.
- [ ] The grammar's layer records, eager and lazy, `binaryOpTag` and
      the eager tails from the tables; its proofs pass unchanged.
- [ ] The serializer's `levels` from both tables, with `?:` as its own
      prefix; its round-trip proofs pass unchanged.
- [ ] `tsc`, `fjs test`, `npm start compile`.

### Related

- [unary-tags](./unary-tags.md) — the unary half of the same table.
