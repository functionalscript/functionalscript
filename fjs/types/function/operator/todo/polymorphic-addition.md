## One polymorphic `addition`, the way `cmp` already does it

**Priority:** P4
**Status:** open

### Problem

The `+` operation is defined three times, and two of the sites carry TODO
comments asking for exactly this issue, with no `todo/` file tracking them:

- `../module.f.mjs:50` — `export const addition = a => b => a + b` for
  `number`, whose JSDoc (`:43-47`) says "We should have one function for
  `number` | `bigint` and `string` … the same approach as … `Cmp1` and
  `Cmp2`".
- `../../../bigint/module.f.mjs:34` — the same lambda for `bigint`, with
  "TODO: should be combined with `addition` for `number`" (`:29`).
- `../../../string/module.f.mjs:49` — the same lambda a third time,
  anonymous, inside
  `concat = fold({ identity: '', operation: a => b => a + b })`.

The fold over it is also written twice, differing only in the identity
literal:

```js
// ../../../bigint/module.f.mjs:42
export const sum = fold({ identity: 0n, operation: addition })
// ../../../number/module.f.mjs:18
export const sum = fold({ identity: 0, operation: addition })
```

The solved form of the identical problem is one directory over, and is what
the TODOs point at: `cmp` in `../../compare/module.f.mjs:27-29` is one
polymorphic definition over `Cmp1`/`Cmp2`, re-exported per domain
(`../../../number/module.f.mjs:33`, `../../../string/module.f.mjs:55`).
`../../../bigint/module.f.mjs:253` carries the same complaint a third time
for `xor` ("It should be combined with `number`").

### Proposal

Define `addition` once here, typed the way `cmp` is — an `Add1`/`Add2` pair,
so that mixed operand types are rejected at the type level while each
domain's re-export keeps its narrow signature. In `types.ts`, beside
`Cmp1`/`Cmp2` (`../../compare/types.ts:13-20`), which this copies minus the
`boolean` row:

```ts
export type Add1 = string | number | bigint

export type Add2<A, B> =
    [A, B] extends [string, string] ? string :
    [A, B] extends [number, number] ? number :
    [A, B] extends [bigint, bigint] ? bigint :
    never
```

```js
/** @type {<A extends Add1>(a: A) => <B extends Add2<A, B>>(b: B) => Add2<A, B>} */
export const addition = a => b => /** @type {any} */ (a) + b
```

**`Add2<A, B>` is the result type, not `A | B`.** That is the load-bearing
difference from `min` (`../../compare/module.f.mjs:38`), which does return
`A | B` because it returns one of its arguments. Addition does not, and the
mapping is what widens the literals: `Add2<1, 2>` reduces to `number`, so
`addition(1)(2)` is `number`, while `A | B` would type it `1 | 2` and `any`
would erase the per-domain signatures this issue exists to preserve. The
constraint and the result are the same expression, exactly as `cmp` writes
`B extends Cmp2<A, B>`; only `cmp`'s result is fixed at `Sign`, because a
comparison's codomain does not vary with its operands.

Checked against `tsc --strict`: all three domains return the widened
primitive (`addition(1)(2)` is not assignable to `1 | 2`), both mixed forms
are rejected — `addition(1)('a')` and `addition(true)(true)` — and the
signature is assignable to `Reduce<number>` / `Reduce<string>`, so
`fold({ identity: 0, operation: addition })` still infers
`(input: List<number>) => number` (`../../../number/module.f.mjs:18`) and
the `bigint` fold still infers its own. That assignability is the one thing
a polymorphic operation can quietly break, so it belongs in the tasks below
as a check, not an assumption.

The cast is required, not incidental: `+` on two generic operands raises
TS2365 even when the constraints admit only addable types. `cmp` carries the
same cast for the same reason — `/** @type {any} */(a) < b ? -1 : …`
(`../../compare/module.f.mjs:28-29`) — so copying that pattern means copying
its escape hatch too. The safety lives in the `Add1`/`Add2` constraints at
the call site, exactly as it does for `cmp`; the cast only gets the body past
the checker.

**Keep the published surface exactly as it is.** Only `bigint` exports
`addition` today (`../../../bigint/module.f.mjs:34`); `number` and `string`
merely *use* the operator module's version, in `sum`
(`../../../number/module.f.mjs:18`) and inside `concat`
(`../../../string/module.f.mjs:49`). So `bigint`'s export becomes a narrowly
typed alias of the polymorphic definition, and `number`/`string` publish
nothing new — they keep importing it. Adding `number.addition` and
`string.addition` for symmetry with `cmp` would be a separate decision:
`cmp` is re-exported per domain because callers ask for it there, and no
caller asks for these. Each new name would also owe a proof entry of its
own — `../../../number/proof.f.mjs:1` and `../../../string/proof.f.mjs:1`
import fixed lists, so a re-export not added to them would be a published
function nothing calls.

The two `sum` folds keep their per-domain identity
literals — the identity genuinely differs, so `sum` stays per-domain; only
the operation stops being re-defined. Delete the two addition TODOs as part
of the change — `../module.f.mjs:43-47` and `../../../bigint/module.f.mjs:29`.
`bigint`'s `xor` TODO (`:253`) stays: `xor` is a different operation with a
different domain, and consolidating it is its own decision.

### Tasks

- [ ] Add `Add1`/`Add2` to `../types.ts` and the polymorphic `addition`
      here. `bigint` keeps its existing `addition` export, now a narrowly
      typed alias; `number` and `string` keep importing it and publish
      nothing new.
- [ ] Give `bigint`'s `addition` a proof entry. It is exported today and
      `../../../bigint/proof.f.mjs` never calls it — a pre-existing gap
      against `fjs/AGENTS.md:25-34`, and this change is what makes it a
      re-export of shared code, where an unexercised alias is exactly how a
      mis-narrowed signature would go unnoticed.
- [ ] Confirm both halves of the typing: `addition(1)(2)` is `number` (not
      `1 | 2`), and the two `sum` folds keep their current inferred
      signatures — the polymorphic form must still be assignable to
      `Reduce<T>`.
- [ ] Remove the two addition TODOs (`../module.f.mjs:43-47`,
      `../../../bigint/module.f.mjs:29`); leave `xor`'s alone.
- [ ] `npx tsc`, `fjs t`.

### Related

- `../../compare/module.f.mjs` — `cmp` over `Cmp1`/`Cmp2`, the pattern to
  copy.
- [../../todo/uncurry-accumulator-types.md](../../todo/uncurry-accumulator-types.md)
  — changes `Fold`/`Reduce` arity and touches every one of these sites;
  independent, but coordinate if both land.
