## defined-values-from-entries. `definedValues` re-implements `definedEntries`' filter

**Priority:** P5
**Status:** open

### Problem

`fjs/types/object/module.f.ts:66-77` expresses "drop the `undefined`-valued
entries" twice, with two different idioms:

```ts
export const definedValues =
    <T>(map: StringMap<string, Exclude<T, undefined>>): readonly Exclude<T, undefined>[] =>
    values(map).filter(v => v !== undefined)

export const definedEntries =
    <T>(cmd: StringMap<string, Exclude<T, undefined>>): readonly (readonly[string, Exclude<T, undefined>])[] =>
    entries(cmd).flatMap(([a, b]) => b === undefined ? [] : [[a, b]])
```

`definedValues` is exactly the values of `definedEntries`, but the
"defined" predicate is written twice — once as `.filter` (the idiom
AGENTS.md steers away from) and once as the preferred `.flatMap` form.

### Proposal

Derive one from the other so the predicate lives once:

```ts
export const definedValues =
    <T>(map: StringMap<string, Exclude<T, undefined>>): readonly Exclude<T, undefined>[] =>
    definedEntries(map).map(([, v]) => v)
```

### Tasks

- [ ] Derive `definedValues` from `definedEntries`.
- [ ] `npx tsc`, `fjs t`; object proofs pass unchanged.

### Related

- AGENTS.md — `definedEntries`/`definedValues` are the mandated iteration
  helpers for `StringMap`; their own definitions should model the preferred
  idiom once, not twice.
