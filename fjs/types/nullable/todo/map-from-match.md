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
types in the derivation (`R` vs. `null`):

```js
/**
 * @type {<T, R1, R2>(f: (_: T) => R1) => (none: () => R2) => (_: Nullable<T>) => R1 | R2}
 */
export const match = f => none => value => value === null ? none() : f(value)

/**
 * @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>}
 */
export const map = f => match(f)(() => null)
```

With `R1`/`R2` inferred independently, `map`'s call site infers `R1 = R`
(from `f`) and `R2 = null` (from `() => null`), giving `R | null` —
exactly `Nullable<R>` — with no cast needed. Existing `match` call sites,
which pass the same type for both branches, still unify `R1 = R2` and are
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
