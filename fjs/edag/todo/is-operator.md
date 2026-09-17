## The `is` operator, `Object.is` as an EDAG node

**Priority:** P2
**Status:** open

### Problem

The EDAG's equality is `===`, and `===` cannot spell the equality the
language is built on: `0 === -0` is `true` and `NaN === NaN` is `false`,
while every guarantee the specifications make about values — DataJS's
`Object.is` guarantee for the normalized form, the analysis's "same inputs"
([`analysis.md`](./analysis.md)), the exact numeric semantics the proofs pin
— is stated with `Object.is`. A program has no way to say it: `Object.is` is
an allowed built-in ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md)),
but a call to it is a call, which the EDAG can only spell as `['()', …]` over
a value the language cannot name, since a global object is a namespace and
never a value.

### Proposal

`is` is a binary operation node, `['is', a, b]`, with `Object.is` semantics:
`true` when its operands are the same value — the same object, the same
primitive, `NaN` with `NaN`, and `0` apart from `-0` — as `own` is the
operation behind the `entry` function, an own-property read the source
spells as a call ([`entry.md`](./entry.md)).

- **Schema.** `is` joins the `op2` ids in [`fjs/edag`](../module.f.mjs)'s
  schema and the README's table, beside `===` and `!==`.
- **Operations.** The operation table both executors share
  ([`analysis.md`](./analysis.md)) implements it as `Object.is`; amnesia's
  proof pins the four cases above against `===`'s answers.
- **Source.** `Object.is(a, b)` is recognized as the operator and lowered to
  `['is', a, b]`, never to a call of a value — the pattern
  [`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)
  argues for `hasOwn`, and the same reading serves here. That spelling waits
  on calls in the language (Stage 2 of
  [`compile-modules-to-edag.md`](../../fsc/todo/compile-modules-to-edag.md));
  the node does not, as `own` did not in its day.
- **Native.** `nanvm-lib` has no SameValue operation yet, so the corpus in
  [`fjs/nanvm`](../../nanvm/module.f.mjs) does not pin `is`; a case is pinned
  only where both executors can run it, and `is` joins the corpus with the
  Rust operation, as `===` did with `strict_eq`.
- **Output.** The FunctionalScript writer
  ([`fjs/fsc/serializer`](../../fsc/serializer/module.f.mjs))
  writes `['is', a, b]` as `Object.is(a, b)`, so the round trip holds once the
  source spelling lands, and refuses it by name until then.

### Tasks

- [x] `is` in the `op2` ids, the RTTI schema and `types.ts`, and the README's
      node table.
- [x] The operations table evaluates `is` as `Object.is`, so amnesia and memo
      both do, with proofs for `NaN`, `-0`, an object with itself and two
      equal objects, each beside `===`.
- [ ] `nanvm-lib` gains the operation, and the corpus pins `is` as it pins
      `===`.
- [ ] Once calls land: `Object.is(a, b)` lowered to the node, with proofs; the
      writer spells the node back.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`analysis.md`](./analysis.md) — the merge's input equality is this
  operator's.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the `Object.is`
  guarantee the format makes, which a program can then state.
- [`2360-built-in.md`](../../../spec/todo/2360-built-in.md) — `Object.is`
  among the allowed built-ins.
