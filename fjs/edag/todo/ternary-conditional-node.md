## Add the `?:` (ternary conditional) node to the EDAG

**Priority:** P2
**Status:** open

### Problem

`nanvm-lib`'s `?:` operator (`Any::conditional`, added in
functionalscript/functionalscript#1867) has no EDAG counterpart:
[`types.ts`](../types.ts)'s `Op1Id`/`Op2Id` vocabularies only cover arity 1
and 2 — there is no arity-3 tag at all, so `?:` cannot be expressed as an
EDAG node today. The shared operator corpus
([`fjs/nanvm/module.f.mjs`](../../nanvm/module.f.mjs)) works around this the
same way it works around `unaryPlus`
([`replace-unary-plus-with-number.md`](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)):
[`fjs/nanvm/types.ts`](../../nanvm/types.ts)'s `NonEdagGroup` gained a
`'ternary'` variant carrying `Case<3>`, whose cases always take the corpus's
"escape" path — build all three operands, apply the operation directly —
rather than lowering to a real expression. Because there is no such thing as
an unevaluated `Value` in the corpus (`Operand` admits no expression whose
evaluation is observable), nothing there proves `?:` actually *branches*:
the discarded arm is built right along with the selected one.

This is not a missing design — it is a missing implementation of an
existing one.
[`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
(subject 3, "Lazy operators and the branch extension path", status:
**decided**) and
[`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md) (which
lists `?:` as `Conditional`, priority 1 — an allowed operator) already
settle `?:` as a real, lazy, arity-3 EDAG node: `["?:", c, t, e]`, "exactly
one of the two arms is established." The gap is purely that
[`types.ts`](../types.ts)'s `Op2`-and-below vocabulary has no arity-3 shape,
and nothing walks `Exp` lazily yet — every consumer today (the inline
evaluator in
[`fjs/nanvm/proof.f.mjs`](../../nanvm/proof.f.mjs), and the future real
interpreter per
[`fjs/djs/todo/interpret-edag.md`](../../djs/todo/interpret-edag.md))
establishes every operand eagerly.

### Proposal

- Add an `Op3Id`/`Op3` (or similarly-named) shape to [`types.ts`](../types.ts)
  with `'?:'` as its member — arity 3, tagged `[id, Exp, Exp, Exp]` — and fold
  it into `Exp`. Update the matching rtti schema in
  [`module.f.mjs`](../module.f.mjs) (a new `op3`, added to `exp`'s `or`).
- This is a *lowering/evaluation* feature, not only a shape change: unlike
  every existing `Op1`/`Op2`, `?:`'s second and third operands are lazy — only
  the selected one is established. Subject 3's "operand shapes are specified
  per command" note is what licenses this without disturbing every other
  node's eager-operand assumption. Whatever walks `Exp` needs a genuinely
  lazy case for `'?:'`, not just a four-tuple pattern match that evaluates
  both branches anyway.
- Once the node exists, move
  [`fjs/nanvm/module.f.mjs`](../../nanvm/module.f.mjs)'s `ternaryCases` group
  from `NonEdagGroup`'s `'ternary'` escape onto a real `Group` with
  `op: '?:'` and canonical `Case<3>` lowering — the same move
  [`replace-unary-plus-with-number.md`](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
  proposes for `unaryPlus` → `'Number'` — retiring the `'ternary'` arm of
  `NonEdagGroup`. This is also the point where the corpus could finally test
  the half of `?:` it cannot today: that the unselected branch is never
  evaluated.
- `nanvm-lib`'s own `Any::conditional` needs no change: it already takes
  three already-evaluated `Any<A>` values, the right shape for whatever
  *calls* it once the EDAG can choose which branch to evaluate before making
  that call.

### Tasks

- [ ] Add an `Op3`-shaped `'?:'` vocabulary to `fjs/edag/types.ts` and its
      rtti schema in `fjs/edag/module.f.mjs`.
- [ ] Give whatever evaluates `Exp` a genuinely lazy `'?:'` case (only the
      selected branch is established).
- [ ] Move `fjs/nanvm/module.f.mjs`'s `ternaryCases` group off `NonEdagGroup`
      onto a real `op: '?:'` `Group`; retire the `'ternary'` `NonEdagGroup`
      arm and its `Case<3>` support in `fjs/nanvm/types.ts` if `?:` ends up
      being the only ternary operator the corpus ever needs.
- [ ] Extend the corpus (or a dedicated lazy-evaluation proof) to assert the
      unselected branch never evaluates, now that an operand can carry
      observable evaluation.
- [ ] `tsc`, `fjs test`, `npm run gen` (diff limited to the corpus's op
      change), `cargo test`, `cargo clippy --lib -- -D warnings`,
      `cargo fmt -- --check`.

### Related

- [`edag-stage1-discussion.md`](../../../todo/edag-stage1-discussion.md)
  subject 3 — the decided design this implements.
- [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md) —
  `?:` already listed as an allowed, priority-1 operator.
- [`replace-unary-plus-with-number.md`](../../../nanvm-lib/todo/replace-unary-plus-with-number.md)
  — the same `NonEdagGroup`-retirement shape, for `unaryPlus`/`'Number'`.
- [`interpret-edag.md`](../../djs/todo/interpret-edag.md) — the eventual real
  interpreter this lazy case belongs in.
- functionalscript/functionalscript#1867 — where `Any::conditional` and the
  `NonEdagGroup` `'ternary'` escape landed.
