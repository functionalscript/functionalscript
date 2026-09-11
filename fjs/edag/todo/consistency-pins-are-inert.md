## `proof.f.mjs`'s `consistency` section checks nothing

**Priority:** P2
**Status:** open

### Problem

Every RTTI constant in [`../module.f.mjs`](../module.f.mjs) is supposed to be
pinned against its declared type in [`../types.ts`](../types.ts). The file
header says so: each node kind is "pinned against its rtti schema in the
sibling module with `Assert<Check<..., typeof ...>>`". Those pins are in
`proof.f.mjs`'s `consistency` section, about thirty of them, and **none of
them is checked**.

They are `@typedef` declarations inside a function body:

```js
consistency: () => {
    /** @typedef {Assert<Check<Call, typeof call>>} _Call */
    ...
}
```

TypeScript does not evaluate the constraint of a declaration nothing
references, so the claim inside `Assert<...>` is never tested. Verified at
`fjs/edag/proof.f.mjs` by rewriting one pin to a flatly false claim —
`Assert<Check<Call, typeof dot>>`, pinning the `call` type to the `dot`
schema — and running both gates: `tsc -p .` exits 0 and `fjs t` reports 127
passing. A second check confirmed the same for a real defect: removing the
`['|.', index]` production from `_optionLambda`'s body *and* its `@type`
tuple together leaves `OptionLambda` with an arm the schema no longer
accepts, and nothing goes red.

The section's own comment has it backwards — "the function body only has to
exist so the typedefs have a local scope" — which is why this survived: the
scope is exactly what makes them inert.

[`../../nanvm/types.ts`](../../nanvm/types.ts) already records this rule and
acts on it, keeping its operand-count assertions at module scope in a `.ts`
file "because a `@typedef` inside a function body is never checked — ... the
same six assertions written there passed with any claim at all". `fjs/edag`
has not had the same treatment.

### What this costs

The `Phantom`/`Check3` machinery exists so a schema and its type cannot drift
apart. While the pins are inert, that drift is caught only by review, and
`Check3`'s own refinement — checking the raw thunk as well as the wrapped
export, so the assertion cannot short-circuit into a tautology — buys
nothing, since the whole assertion is skipped.

Three containment pins for the chain states now live at module scope in
`../types.ts` and are checked (each was positive-controlled). They are a
small part of what `consistency` claims to cover.

### Proposal

Move the `consistency` assertions to module scope in a `.ts` file, as
`../../nanvm/types.ts` does. `../types.ts` is the natural home, since that is
what each pin is about; the ones that need a `typeof` from `module.f.mjs`
need an `import type` rather than an `@import`, which is a change of file
kind and not only of position.

Each moved pin should be positive-controlled once — falsified, seen to go
red, restored — because a pin that has never failed is indistinguishable
from one that cannot.

Whether `consistency` then keeps an empty body or goes entirely is part of
this issue: `proof.f.mjs` is not documentation a reader is meant to get from
`deno doc` ([`../../AGENTS.md`](../../AGENTS.md)), so a section that asserts
nothing has no reason to stay.

### Tasks

- [ ] Move every `consistency` pin to module scope in a `.ts` file.
- [ ] Positive-control each one: falsify, confirm `tsc` goes red, restore.
- [ ] Fix any pin that turns out to have been false all along.
- [ ] Decide what becomes of the `consistency` entry itself.
- [ ] `tsc`, `fjs t`.

### Related

- [`../../nanvm/types.ts`](../../nanvm/types.ts) — the same rule, already
  written down and already acted on, with the comment this issue quotes.
- `_regionProductions` in [`../module.f.mjs`](../module.f.mjs) (shipped) —
  found this while checking whether sharing the option states' common
  productions would weaken the pins. It could not: there was nothing to
  weaken.
