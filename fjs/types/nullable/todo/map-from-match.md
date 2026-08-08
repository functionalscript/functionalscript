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

Derive `map` from `match`:

```js
/**
 * @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>}
 */
export const map = f => match(f)(() => null)
```

Typing rider: `match`'s declared return `Nullable<R>` is wider than its
actual `R` (both branches return `R`); the `@type` cast on `map` papers over
the mismatch, same as today's independent casts on `map`/`match`. While
touching the file, consider tightening `match`'s JSDoc return type to `R`
so `map`'s cast can drop the extra widening.

### Tasks

- [ ] Derive `map` from `match`; optionally tighten `match`'s return type.
- [ ] `npx tsc`, `fjs t`; nullable proofs pass unchanged.

### Related

- [../../ordered_map/todo/at-nullable-map.md](../../ordered_map/todo/at-nullable-map.md)
  — routes a consumer through `nullable.map`; same caliber, different
  direction (consumer→combinator vs inside the combinator pair).
- [../../function/operator/todo/derive-concat-from-join.md](../../function/operator/todo/derive-concat-from-join.md)
  — the same derive-one-from-its-sibling pattern elsewhere.
