# 199. `dev`: reuse `string.cmp` instead of an ad-hoc entry comparator

## Problem

`fs/dev/module.f.ts:48` defines a local entry comparator that
re-derives string comparison inline:

```ts
const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>): Sign =>
    a < b ? -1 : a > b ? 1 : 0
```

It is used exactly once, at `:116`, to feed `Array.prototype.toSorted`
in `loadModuleMap`:

```ts
.toSorted(cmp)
```

The expression `a < b ? -1 : a > b ? 1 : 0` is exactly what
`fs/types/string/module.f.ts:35` (`cmp`) does, and what the underlying
generic `cmp` in `fs/types/function/compare/module.f.ts:33` already
implements for all `Cmp1` primitives (including `string`). Reaching
for the existing comparator removes both the duplication and the
imported `Sign` type that's only kept around to type the local helper.

## Proposed change

```ts
// fs/dev/module.f.ts
import { cmp as strCmp } from '../types/string/module.f.ts'

// drop the local `cmp` and the `Sign` import; sort by the first tuple element.
.toSorted(([a], [b]) => strCmp(a)(b))
```

Or, since the only consumer is sorted by the string key, fold the
projection into a helper next to `strCmp`:

```ts
// fs/types/string/module.f.ts
import type { Cmp } from '../function/compare/module.f.ts'
export const cmpBy = <T>(key: (v: T) => string): Cmp<T> =>
    a => b => cmp(key(a))(key(b))
// becomes used here as: .toSorted(cmpBy<Entry<unknown>>(([k]) => k))
```

The lightweight inline form is fine — `cmpBy` is speculative until a
second call site exists.

## Why this qualifies

- Separation of concerns: string comparison belongs in
  `fs/types/string`, not inlined into a build/dev module. Today
  `fs/dev/module.f.ts` carries its own copy of the algorithm just to
  reach into a tuple.
- Tiny but cumulative: the imported `Sign` type goes away with the
  local `cmp`, shrinking the file's import surface by one.
- The change is mechanical and behavior-preserving — `a < b ? -1 :
  a > b ? 1 : 0` and `strCmp(a)(b)` return identical values for any two
  strings.

## Caveats

- `toSorted` calls the comparator with positional args
  `(a, b) => number`; FunctionalScript's `cmp` is curried (`a => b =>
  Sign`). Wrap at the call site (`([a], [b]) => strCmp(a)(b)`) rather
  than uncurrying `strCmp` itself — curried comparators are how the
  rest of the codebase composes them (`sorted_list.find`,
  `range_map.merge`, etc.).
- This issue is intentionally narrow: it doesn't propose moving the
  `toSorted` call into the FunctionalScript `sorted_*` modules (the
  result lives in a `fromEntries`-built object, not a `SortedList`),
  and it doesn't propose an Effect-aware sort. Both would be larger
  changes that should be filed separately if there's demand.

## Related

- `fs/types/string/module.f.ts:35` — `cmp` for strings.
- `fs/types/function/compare/module.f.ts:33` — the generic `cmp` over
  `Cmp1` primitives.
- [i184](./184-min-max-comparable.md) — same flavor: lift per-type
  comparison/min/max copies onto the generic `compare` API.
