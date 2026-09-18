## Grouping, `( expression )`

**Priority:** P2
**Status:** open

### Problem

The language has no parentheses around a value, so what JavaScript spells
with them cannot be spelled at all:

- a function whose body is an object literal, `(...a) => ({ x: a })` — the
  body rule refuses `{`, since JavaScript reads `=> {` as a block; the block
  body spells that function another way,
  `(...a) => { return { x: a }; }`, so this is the shorter spelling rather
  than the only one;
- a written comma, `(check, result)`, once the operator lands
  ([`2340-operators.md`](../../../spec/todo/2340-operators.md)), which
  cannot stand bare where a value is wanted;
- an access on a grouped value, `([1, 2]).length`, and every operator
  expression to come, whose precedence parentheses override.

The FunctionalScript writer
([`../serializer`](../serializer/module.f.mjs)) writes a function with an
object body as a block until this lands.
[`2350-grouping.md`](../../../spec/todo/2350-grouping.md)
holds the feature with one example and no rules.

### Proposal

A group is a value in parentheses and denotes that value: it makes no node
in the AST or the EDAG, and `(x)` lowers to whatever `x` lowers to, so the
graph and its sharing are as if the parentheses were not there — which is
what JavaScript does, and what keeps a group free of a canonical-form
question.

- **Grammar.** A value alternative `'(' t group`, where `group` is either
  the rest of a function, `'...' t id t ')' s '=>' t body`, or a value
  followed by `')' t`. The function and the group share the `(` and part at
  the next symbol, `...` against a value's first symbol, so the grammar
  stays LL(1) without lookahead past the `)`; the same alternative serves
  `body`, so a body may be a group. A group takes accesses, as any value
  does: `([1]).length`.
- **Mapping.** The group's node is its value's node with the accesses
  after the `)` applied; nothing is recorded.
- **What it admits.** `(...a) => ({ x: a })`; `(5)`, `((5))`, `(a).b`,
  `([1, 2]).length`. `()` and `(,)` are refused by the grammar. A group is
  where `(-1).x` becomes spellable — the access on the negation, which the
  prefix alone cannot say, since `-1 .x` is `-(1 .x)`; and a group is what
  lets `-` take a function, `-((...a) => 1)` being a `UnaryExpression`
  where `-(...a) => 1` is a syntax error.
- **Not in scope.** Parenthesized parameters `(a, b) => …`, which JavaScript
  tells from a group only past the `)`, wait on named parameters
  ([`3120-parameters.md`](../../../spec/todo/3120-parameters.md)); the
  comma inside a group waits on the operator.

### Tasks

- [ ] Grammar: the `(` alternative of `value` and `body`, the function under
      it, and the LL(1) proof; the README's grammar and the module summary
      updated.
- [ ] Mapping: the group's node is its value's, accesses applied.
- [ ] Proofs: the object-literal body, nested groups, a group with accesses,
      a group of a reference sharing as the reference does, `()` refused;
      the EDAG of `(x)` is `x`'s node. And what the group is *for* here:
      `(-1).x` is the access on the negation, where `-1 .x` is the negation
      of the access, and `-((...a) => 1)` negates a function where
      `-(...a) => 1` is a syntax error.
- [ ] `spec/README.md`: parentheses in the Functions section for the object
      body, and a Grouping sentence where values are described;
      `2350-grouping.md` folded in and its roadmap entry removed.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`2350-grouping.md`](../../../spec/todo/2350-grouping.md) — the feature's
  place on the language roadmap.
- [`../serializer`](../serializer/module.f.mjs) — the writer that needs the
  parenthesized body.
- [`compile-modules-to-edag.md`](./compile-modules-to-edag.md) — Stage 2's
  chain lowering names grouping where optional chaining enters.
