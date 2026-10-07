## unary-tags. `-`, `~`, `!`, `typeof` and `throw` each get their own frame kind and work kind

**Priority:** P4
**Status:** open

### Problem

[`ast`](../ast/module.f.mjs) names the binary operators once, as
`binaryTags` with `isBinary`, and the consumers dispatch on that. The
unary operators have no such name, so each consumer spells them one
arm at a time.

The parser's explicit stack in [`parser`](../parser/module.f.mjs) has a
frame kind per operator — `_NegFrame`, `_BitnotFrame`, `_NotFrame` and
`_TypeofFrame` in its `private.ts` — and `enter` and `returned` each have one
arm per kind that differs only in the tag:

```js
// parser enter
case '-': { return [{ top: { neg: true }, rest: stack }, scope, ['enter', node[1]]] }
case '~': { return [{ top: { bitnot: true }, rest: stack }, scope, ['enter', node[1]]] }
// parser returned
if ('neg' in frame) { const negated = ['-', value]; return [stack, scope, ok(negated)] }
if ('bitnot' in frame) { const complemented = ['~', value]; return [stack, scope, ok(complemented)] }
```

The lowering in [`edag`](../edag/module.f.mjs)'s `lower` has a work kind
per operator in `_LowerWork`, and the `'bitnot'` and `'throw'` arms are
one arm written twice but for the tag and the assertion's text:

```js
// edag lower
if (work.kind === 'bitnot') {
    const operand = assertNotNullish(results, ['no operand for a bitwise not', root])
    results = { top: { exp: ['~', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
    …
}
if (work.kind === 'throw') {
    const operand = assertNotNullish(results, ['no value for a throw', root])
    results = { top: { exp: ['throw', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
    …
}
```

`'neg'` is the same arm plus the constant folding of a negated literal, and
`'not'` and `'typeof'` are the `'bitnot'` arm a third and a fourth time: `!`
and `typeof` landed in the pattern as it stood, one more copy of each arm
apiece.

### Proposal

`ast` exports `unaryTags` and `isUnary` beside `binaryTags` and
`isBinary`. The parser keeps one frame, `{ unary: '-' | '~' | '!' | 'typeof' }`,
and one `enter` arm and one `returned` arm over it. `_LowerWork` keeps one
`{ kind: 'unary', tag }` work, with negation's literal folding where the
literal is met, as a leaf case, rather than as a work kind of its own.

### Tasks

- [ ] `unaryTags`/`isUnary` in `ast`.
- [ ] One unary frame in the parser; `_NegFrame`, `_BitnotFrame`, `_NotFrame`
      and `_TypeofFrame` go.
- [ ] One unary work in `edag`'s `lower`.
- [ ] `tsc`, `fjs test`, `npm start compile`.

### Related

- [frame-advance](../parser/todo/frame-advance.md) — the counting
  frames; unary frames are the ones that do not count, and this is their
  collapse.
- [deep-nesting-recursion](./deep-nesting-recursion.md) — `lowerLeaf`'s
  recursion, which the unary work arms sit beside.
- [one-precedence-table](./one-precedence-table.md) — the binary half
  of the same table.
