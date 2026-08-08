## map-from-match. Derive `map` from `match` so the null-guard lives once

**Priority:** P5
**Status:** open

### Problem

`fjs/types/nullable/module.f.mjs:18-23` writes the null-dispatch guard twice:

```js
export const map = f => value => value === null ? null : f(value)

export const match = f => none => value => value === null ? none() : f(value)
```

`map` is exactly `match` with the `none` branch fixed to `() => null`. This
module is the codebase's canonical home for absence handling — the
`at-nullable-map` todo routes consumers *to* it — yet internally the
`value === null ? … : f(value)` projection is duplicated between its own two
combinators.

### Proposal

`match`'s current JSDoc type ties both branches to one `R`:
`<T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>`.
Deriving `map = f => match(f)(() => null)` against that type does **not**
type-check: `none: () => R` requires `null` assignable to the generic `R`,
which fails (TS2322) for an unconstrained `R`, and a `.mjs` call site has no
JSDoc syntax to explicitly instantiate `match`'s `R` at `Nullable<R>` the way
a `.ts` cast could.

Tightening `match`'s return type is therefore a **required first step**, not
an optional cleanup — and it must decouple the two branches, not just narrow
the existing shared `R`, since `f` and `none` genuinely return different
types in the derivation (`R` vs. `null`).

**`R1`/`R2` must live on separate curry steps, not the same generic
function.** All of `T`, `R1`, `R2` on one outer generic
(`<T, R1, R2>(f: (_: T) => R1) => (none: () => R2) => …`) are instantiated
together at the *first* call `match(f)` — before `none` is even supplied —
so `R2` has no argument to infer from at that point and collapses to
`unknown`; `match(f)(() => null)` then types as
`(_: Nullable<T>) => unknown`, which still fails against `map`'s declared
`Nullable<R>` return. `R2` needs its own generic step, inferred from `none`
at the *second* call:

```js
/**
 * @type {<T, R1>(f: (_: T) => R1) => <R2>(none: () => R2) => (_: Nullable<T>) => R1 | R2}
 */
export const match = f => none => value => value === null ? none() : f(value)

/**
 * @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>}
 */
export const map = f => match(f)(() => null)
```

Now `T`/`R1` are inferred at `match(f)` (from `f`), and `R2` is inferred
separately at `(() => null)` (from `none`), giving `R1 | R2` = `R | null` =
`Nullable<R>` — with no cast needed. Existing `match` call sites, which
supply both `f` and `none` together, still unify to the same result and are
unaffected.

### Tasks

- [ ] Generalize `match`'s JSDoc type to independent `R1`/`R2` branch types
      (required for the derivation to type-check).
- [ ] Derive `map` from `match`.
- [ ] `npx tsc`, `fjs t`; nullable proofs pass unchanged.

### Related

- [../../ordered_map/todo/at-nullable-map.md](../../ordered_map/todo/at-nullable-map.md)
  — routes a consumer through `nullable.map`; same caliber, different
  direction (consumer→combinator vs inside the combinator pair).
- [../../function/operator/todo/derive-concat-from-join.md](../../function/operator/todo/derive-concat-from-join.md)
  — the same derive-one-from-its-sibling pattern elsewhere.
