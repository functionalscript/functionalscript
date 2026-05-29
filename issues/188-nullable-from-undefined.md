# 188. `nullable.fromUndefined`: one place for "`undefined` → `null`" normalization

**Priority:** P3
**Status:** open

Two modules independently normalize a JavaScript lookup that may yield
`undefined` into the codebase's `Nullable` (`null`) convention:

```ts
// fs/types/array/module.f.ts:65
export const at = (i: number) => <T>(a: readonly T[]): T | null => {
    const r = a[i]
    return r === undefined ? null : r
}
```

```ts
// fs/types/object/module.f.ts:20
export const at: (name: string) => <T>(object: Map<T>) => T|null
    = name => object => {
        const r = getOwnPropertyDescriptor(object, name)
        return r === undefined ? null : r.value
    }
```

The lookup mechanism differs (index access vs. `getOwnPropertyDescriptor`), but
the `r === undefined ? null : …` normalization is the same invariant in both.

## Proposed abstraction

`fs/types/nullable` is the natural home — it already owns `Nullable<T>`, `map`,
and `toOption`. Add:

```ts
// fs/types/nullable
export const fromUndefined = <T>(value: T | undefined): Nullable<T> =>
    value === undefined ? null : value
```

Then:

```ts
// array  (already imports `map` from nullable)
export const at = (i: number) => <T>(a: readonly T[]): T | null => fromUndefined(a[i])

// object
export const at: (name: string) => <T>(object: Map<T>) => T | null
    = name => object => map(d => d.value)(fromUndefined(getOwnPropertyDescriptor(object, name)))
```

## Why this qualifies

- DRY with two real consumers (`array.at`, `object.at`) of the same
  `undefined → null` boundary rule.
- It names the JS↔FunctionalScript boundary ("the host returns `undefined`; we
  speak `null`") in the module that defines `Nullable`, so future host-API
  wrappers reuse it instead of re-spelling the ternary.

## Caveats

- `object.at` additionally projects `.value` off the descriptor, so the shared
  piece is only the `undefined → null` step; the `array` site collapses fully
  while the `object` site still composes a `map`. This is a small extraction (one
  line saved per site), justified by de-duplicating the invariant rather than by
  raw line count.
- Behavior-preserving: both call sites return exactly the same values.

## Related

- [i169](./README.md) — also about leaning on `nullable`/standard helpers instead
  of bespoke per-module code.
