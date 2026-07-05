## 66r-allvoid-combinator. `allVoid` combinator for parallel fan-out that discards results

**Priority:** P4
**Status:** open

### Problem

The *fan out in parallel, then discard the results* idiom is spelled out
verbatim three times in `fs/emergent_testing/module.f.ts` (lines 175, 180,
253):

```ts
return all(...sub.map(e => registerOne(t, e))).step(() => pure(undefined))
return all(...tests.map(e => registerOne(ctx, e))).step(() => pure(undefined))
return all(...modules.map(([k, v]) => registerModule(ctx, k, v, star))).step(() => pure(undefined))
```

`fs/effects/module.f.ts` already ships `forEachStep` (the *sequential* void
combinator, line 90), and [allreduce-combinator](./allreduce-combinator.md)
covers the parallel *reduce* variant — but the parallel *void* sibling is
missing, so every call site re-spells `all(...xs.map(f)).step(() =>
pure(undefined))`.

### Proposal

Add the void sibling in `fs/effects/node/module.f.ts`, next to `all` /
`All` / `both`. It cannot live next to `forEachStep` in the core
`fs/effects/module.f.ts`: `all`/`All` are defined in the node module,
which already imports the core module — placing `allVoid` in core would
invert that dependency. (`fs/emergent_testing` already imports `all` from
the node module, so the call sites need no new import path.)

```ts
export const allVoid =
    <O extends Operation, T>(f: (item: T) => Effect<O, void>) =>
    (items: readonly T[]): Effect<O | All, void> =>
        all(...items.map(f)).step(() => pure(undefined))
```

If `All` is ever lowered out of the node module (it is runner
infrastructure, not node-specific I/O — a separate design question),
`allVoid` moves down with it alongside `all` and `both`.

The three call sites become `allVoid(e => registerOne(t, e))(sub)` etc.
If [allreduce-combinator](./allreduce-combinator.md) lands first, consider
deriving `allVoid` from `allReduce` with a unit monoid instead of
duplicating the `all(...map)` core — whichever reads better.

### Tasks

- [ ] Add `allVoid` to `fs/effects/node/module.f.ts` (next to `all`/`both`)
      with proof coverage.
- [ ] Convert the three call sites in `fs/emergent_testing/module.f.ts`.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — the aggregating
  sibling; `allVoid` discards.
- `fs/effects/module.f.ts:90` — `forEachStep`, the sequential sibling.
