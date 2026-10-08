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
primitive, `NaN` with `NaN`, and `0` apart from `-0` — as `['entry']` is
the function behind the `entry` helper, a data-entry read the source spells
as a call ([spec: entry](../../../spec/README.md#reading-an-entry-at-run-time)).

- **Schema.** `is` joins the `op2` ids in [`fjs/edag`](../module.f.mjs)'s
  schema and the README's table, beside `===` and `!==`.
- **Operations.** The operation table both executors share
  ([`analysis.md`](./analysis.md)) implements it as `Object.is`; amnesia's
  proof pins the four cases above against `===`'s answers.
- **Source.** Recognize the parsed call `Object.is(a, b)` and lower it to
  `['is', a, b]`, never a raw-token pattern. Follow the
  [statement-aware recognition boundary](../../compiler/parser/todo/statement-aware-intrinsics.md):
  statements, expressions and bindings are resolved before the complete
  pattern is admitted. `Object` must resolve to the intrinsic namespace.
  The earlier `Object.hasOwn` precedent is withdrawn; it is not needed to
  justify preserving `Object.is`'s own semantics. The node can precede
  admission of its source pattern, as `own` did.
- **Native.** `nanvm-lib` answers it with `Any::same_value`, and the corpus in
  [`fjs/nanvm`](../../nanvm/module.f.mjs) pins `is` on both executors, as it
  pins `===`.
- **Output.** The FunctionalScript writer
  ([`fjs/compiler/serializer`](../../compiler/serializer/module.f.mjs))
  writes `['is', a, b]` as `Object.is(a, b)`, so the round trip holds once the
  source spelling lands, and refuses it by name until then.

### Tasks

- [x] `is` in the `op2` ids, the RTTI schema and `types.ts`, and the README's
      node table.
- [x] The operations table evaluates `is` as `Object.is`, so amnesia and memo
      both do, with proofs for `NaN`, `-0`, an object with itself and two
      equal objects, each beside `===`.
- [x] `nanvm-lib` gains the operation (`Any::same_value`, printed as
      `vm::unstable::object_is`), and the corpus pins `is` as it pins `===`.
- [ ] Recognize the bound AST call and lower it to the node, with proofs;
      the writer spells the node back.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`analysis.md`](./analysis.md) — the merge's input equality is this
  operator's.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the `Object.is`
  guarantee the format makes, which a program can then state.
- [`2360-built-in.md`](../../../spec/todo/2360-built-in.md) — `Object.is`
  among the allowed built-ins.
