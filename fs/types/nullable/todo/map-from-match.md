## map-from-match. Derive `map` from `match` so the null-guard lives once

**Priority:** P5
**Status:** open

### Problem

`fs/types/nullable/module.f.ts:12-16` writes the null-dispatch guard twice:

```ts
export const map: <T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>
    = f => value => value === null ? null : f(value)

export const match: <T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>
    = f => none => value => value === null ? none() : f(value)
```

`map` is exactly `match` with the `none` branch fixed to `() => null`. This
module is the codebase's canonical home for absence handling — the
`at-nullable-map` todo routes consumers *to* it — yet internally the
`value === null ? … : f(value)` projection is duplicated between its own two
combinators.

### Proposal

Derive `map` from `match`:

```ts
export const map = <T, R>(f: (value: T) => R): (value: Nullable<T>) => Nullable<R> =>
    match<T, Nullable<R>>(f)(() => null)
```

Typing rider: `match`'s declared return `Nullable<R>` is wider than its
actual `R` (both branches return `R`); instantiating it at `Nullable<R>` (as
above) makes the derivation check because `Nullable<Nullable<R>>` collapses
to `Nullable<R>`. While touching the file, consider tightening `match`'s
return type to `R` — then `map = match(f)(() => null)` needs no explicit
instantiation at all.

### Tasks

- [ ] Derive `map` from `match`; optionally tighten `match`'s return type.
- [ ] `npx tsc`, `fjs t`; nullable proofs pass unchanged.

### Related

- [../../ordered_map/todo/at-nullable-map.md](../../ordered_map/todo/at-nullable-map.md)
  — routes a consumer through `nullable.map`; same caliber, different
  direction (consumer→combinator vs inside the combinator pair).
- [../../function/operator/todo/derive-concat-from-join.md](../../function/operator/todo/derive-concat-from-join.md)
  — the same derive-one-from-its-sibling pattern elsewhere.
