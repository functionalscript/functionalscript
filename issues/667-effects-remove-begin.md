# 667-effects-remove-begin. Remove `begin` from Effects

**Priority:** P3
**Status:** done

## Problem

`begin` is a redundant alias:

```ts
// fs/effects/module.f.ts
export const begin: Effect<never, void> = pure(undefined)
```

It carries no semantic meaning beyond "start a chain". Every use of `begin` can be replaced with `pure(undefined)` directly, making the chain start explicit and removing a name that implies imperative sequencing rather than functional composition.

## Current consumers

- `fs/ci/module.f.ts` — `return begin.step(...)`
- `fs/dev/module.f.ts` — `const load = (...) => begin.step(...)`
- `fs/dev/version/module.f.ts` — `const readJson = ... begin.step(...)` and `export const updateVersion = begin.step(...)`
- `fs/effects/node/module.f.ts` — re-exports `begin`
- `fs/cas/module.f.ts` — multiple `begin.step(...)` chains

## Proposal

1. Remove `export const begin` from `fs/effects/module.f.ts`.
2. Remove `begin` from the re-export in `fs/effects/node/module.f.ts`.
3. Replace each `begin.step(() => f)` with `f` in all consumers.

## Related

- `fs/effects/module.f.ts` — definition
- `fs/effects/node/module.f.ts` — re-export
