## allvoid-combinator. `allVoid` combinator for parallel fan-out that discards results

**Priority:** P4
**Status:** blocked
**Blocked by:** [node-module-layering](./node-module-layering.md)

> **Destination superseded (2026-07).** The proposal below places `allVoid` in
> `fjs/effects/node/module.f.mjs` because that is where `all`/`All` live today,
> and notes that if `All` is ever lowered out of the node module `allVoid`
> "moves down with it". [node-module-layering](./node-module-layering.md) is
> that lowering: `All`/`all`/`both` go to `fjs/effects/all/module.f.mjs`, and
> `allVoid` belongs there with them.
>
> Land the `All` move first, then add `allVoid` to `fjs/effects/all` — writing
> it into the node module now would only earn it a second, breaking relocation.
> The proposal's body is otherwise unchanged and still correct; substitute
> `fjs/effects/all/module.f.mjs` wherever it says `fjs/effects/node/module.f.mjs`.

### Problem

The *fan out in parallel, then discard the results* idiom is spelled out
verbatim three times in `fjs/emergent_testing/module.f.mjs`:

```ts
return mapStep(all(...sub.map(e => registerOne(t, e))), () => undefined)

return mapStep(all(...tests.map(e => registerOne(ctx, e))), () => undefined)

return mapStep(all(...modules.map(([k, v]) => registerModule(ctx, k, v, star))), () => undefined)
```

`fjs/effects/module.f.mjs` already ships `forEachStep` (the *sequential* void
combinator, line 90), and [allreduce-combinator](./allreduce-combinator.md)
covers the parallel *reduce* variant — but the parallel *void* sibling is
missing, so every call site re-spells the whole fan-out-then-discard dance.

### Proposal

Add the void sibling in `fjs/effects/node/module.f.mjs`, next to `all` /
`All` / `both`. It cannot live next to `forEachStep` in the core
`fjs/effects/module.f.mjs`: `all`/`All` are defined in the node module,
which already imports the core module — placing `allVoid` in core would
invert that dependency. (`fjs/emergent_testing` already imports `all` from
the node module, so the call sites need no new import path.)

Use the standalone `step` combinator — `all(...)` returns a raw `Effect`, which
has no `.step` method:

```ts
export const allVoid =
    <O extends Operation, T>(f: (item: T) => Effect<O, void>) =>
    (items: readonly T[]): Effect<O | All, void> =>
        step(all(...items.map(f)), () => pure(undefined))
```

If [map-step-combinator](./map-step-combinator.md) lands first this is
`mapStep(all(...items.map(f)), () => undefined)`, which is the same thing said
once more directly. Either spelling works; neither is a dependency.

If `All` is ever lowered out of the node module (it is runner
infrastructure, not node-specific I/O — a separate design question),
`allVoid` moves down with it alongside `all` and `both`.

The three call sites become `allVoid(e => registerOne(t, e))(sub)` etc.
If [allreduce-combinator](./allreduce-combinator.md) lands first, consider
deriving `allVoid` from `allReduce` with a unit monoid instead of
duplicating the `all(...map)` core — whichever reads better.

### Tasks

- [ ] Wait for [node-module-layering](./node-module-layering.md) to move
      `All`/`all`/`both` to `fjs/effects/all/module.f.mjs`.
- [ ] Add `allVoid` there (next to `all`/`both`) with proof coverage — **not**
      to `fjs/effects/node/module.f.mjs`, per the note at the top of this issue.
- [ ] Convert the three `mapStep(all(...), () => undefined)` call sites in
      `fjs/emergent_testing/module.f.mjs`.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — the aggregating
  sibling; `allVoid` discards.
- `fjs/effects/module.f.mjs:297` — `forEachStep`, the sequential sibling.
