## at-nullable-map. `at` should project through `nullable.map`

**Priority:** P5
**Status:** open

### Problem

The codebase has a canonical null-projection combinator —
`map` in `fjs/types/nullable/module.f.ts` (`f => value => value === null ?
null : f(value)`) — and `array`'s safe accessors already route through it.
`ordered_map.at` (`fjs/types/ordered_map/module.f.ts:23-28`) re-inlines the
same shape by hand:

```ts
export const at
    = (name: string) => <T>(map: OrderedMap<T>): T | null => {
        if (map === null) { return null }
        const result = value(find(keyCmp(name))(map).first)
        return result === null ? null : result[1]
    }
```

The final ternary is `nullable.map` applied to a tuple projection, and the
repo's destructuring preference (`AGENTS.md`) argues for `([, v]) => v`
over `result[1]`.

### Proposal

```ts
import { map as nullableMap } from '../nullable/module.f.ts'

export const at
    = (name: string) => <T>(map: OrderedMap<T>): T | null =>
        map === null
            ? null
            : nullableMap(([, v]: Entry<T>) => v)(value(find(keyCmp(name))(map).first))
```

A one-site readability/consistency move: every absence-handling projection
points at the one `Nullable` combinator instead of a bespoke ternary.

### Tasks

- [ ] Rewrite `at` through `nullable`'s `map`.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- `fjs/types/nullable/module.f.ts` — the combinator.
- `fjs/types/array/module.f.ts` — precedent: safe accessors already use it.
