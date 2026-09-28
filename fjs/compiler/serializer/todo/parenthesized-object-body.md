## A function body that is an object, in parentheses

**Priority:** P3
**Status:** open

### Problem

A function whose body's text begins with `{` is written as a block, because
`=> {` opens a block in JavaScript and not an object:

```js
export default (...$a)=>{return {"a":1};};
```

Grouping has landed ([spec: grouping](../../../../spec/README.md#grouping)),
so the source language has the shorter spelling for the same function, and
the writer does not use it:

```js
export default (...$a)=>({"a":1});
```

### Proposal

In `lambdaBody`, where a body needing no `const` is written as an
expression, wrap the text in `(` and `)` instead of turning it into
`{return …;}` when its first chunk opens with `{`. The parser reads the
group back to the same graph — `(x)` is `x` — so the round-trip the writer
owes is unaffected, and the text is four characters shorter.

A body that *needs* a `const` stays a block; that is where the `const`
lives, and a group has no place for one.

The question this is worth asking while changing it: whether the choice
belongs to the *text* at all. A block is currently chosen by reading the
written text's first character, which is what makes it independent of which
node begins with `{` — an object literal, or an access on one,
`['.', ['{}', …], 'a']`. A group would be chosen on the same evidence, so
the shape of the decision does not change, only its answer.

### Tasks

- [ ] Write the parenthesized expression body in `lambdaBody` where the
      block is chosen only because the text opens with `{`.
- [ ] Update the proofs that pin the block spelling, in
      [`../proof.f.mjs`](../proof.f.mjs) and
      [`../../proof.f.mjs`](../../proof.f.mjs) (`fjsRoundTrip`), and keep a
      proof that a body needing a `const` is still a block.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `lambdaBody`, which chooses the
  spelling.
- [`../../parser/grammar/module.f.mjs`](../../parser/grammar/module.f.mjs) —
  `group`, the rule that reads it back.
