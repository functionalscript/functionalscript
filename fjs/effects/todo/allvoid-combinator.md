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
return mapStep(allOk(...sub.map(e => registerOne(t, e))), () => undefined)

return mapStep(allOk(...tests.map(e => registerOne(ctx, e))), () => undefined)

return mapStep(allOk(...modules.map(([k, v]) => registerModule(ctx, k, v, star))), () => undefined)
```

`fjs/effects/module.f.mjs` already ships `forEachStep` (the *sequential* void
combinator), and [allreduce-combinator](./allreduce-combinator.md)
covers the parallel *reduce* variant — but the parallel *void* sibling is
missing, so every call site re-spells the whole fan-out-then-discard dance.

### Proposal

Add the void sibling in `fjs/effects/node/module.f.mjs`, next to `all` /
`All` / `both`. It cannot live next to `forEachStep` in the core
`fjs/effects/module.f.mjs`: `all`/`All` are defined in the node module,
which already imports the core module — placing `allVoid` in core would
invert that dependency. (`fjs/emergent_testing` already imports `allOk` from
the node module, so the call sites need no new import path.)

Build it on `allOk`, not on `all`. `all` answers `readonly Result<T, E>[]` —
the children's failures arrive *inside* its value — so discarding that value
discards them, and a fan-out whose children all failed would report success.
That is the value-discarding hazard `allOk`'s own doc comment names: it
collapses the list to `readonly T[]` and lifts the first failure into the
effect's error channel, where `step`/`mapStep` propagate it. The three call
sites already spell it that way.

`mapStep` is the projection combinator and has landed in
`fjs/effects/module.f.mjs`, so this is one line:

```ts
export const allVoid =
    <O extends Operation, T, E>(f: (item: T) => Effect<O, void, E>) =>
    (items: readonly T[]): Effect<O | All, void, NotImplemented | E> =>
        mapStep(allOk(items.map(f)), () => undefined)
```

The body hands `allOk` the *list*, not a spread: `allVoid` exists for
arbitrary-length fan-outs, which is exactly where `allOk(...items.map(f))`
would rebuild the engine argument ceiling
([all-argument-limit](./all-argument-limit.md)) inside the new combinator —
the same correction [allreduce-combinator](./allreduce-combinator.md)
carries. That makes this issue's landing depend on the list-shaped `allOk`
from that issue; until it lands, the spread spelling is the only one that
compiles, which is one more reason this issue is scheduled after the `All`
move rather than before it.

`NotImplemented` in the error channel is the runner's, inherited from `allOk`;
`E` is the children's. Written with the standalone `step` instead —
`step(allOk(items.map(f)), () => pureOk(undefined))` — it is the same effect
said less directly; either works. Note `pureOk`, not `pure`: `pure` takes a
`Result` (`pureOk = v => pure(ok(v))`), so `pure(undefined)` would yield a bare
`undefined` where the chain expects `ok(undefined)`. Both spellings must also
use the standalone combinators: `allOk(...)` returns a raw `Effect`, which has
no `.step` method.

If `All` is ever lowered out of the node module (it is runner
infrastructure, not node-specific I/O — a separate design question),
`allVoid` moves down with it alongside `all` and `both`.

**`allOk` moves with them.** [node-module-layering](./node-module-layering.md)
originally moved `All` / `all` / `both` only, which would have left `allOk` in
`fjs/effects/node/module.f.mjs` — and an `allVoid` built on `allOk` would then
make `fjs/effects/all` import from `fjs/effects/node`, the inversion that
lowering exists to remove, and a cycle once `effects/node` imports the moved
`All` family back. That issue's move set now names `allOk` too, so nothing
further is needed there. It belongs in it by the layering issue's own test:
`allOk` is `ioStep(all(…), rs => pure(okList(rs)))`, concurrency plumbing with
no host API in it.

The three call sites become `allVoid(e => registerOne(t, e))(sub)` etc.
If [allreduce-combinator](./allreduce-combinator.md) lands first, consider
deriving `allVoid` from `allReduce` with a unit monoid instead of
duplicating the `allOk(...map)` core — but only once `allReduce` is itself
built on `allOk`. As proposed it folds over `all(...)`, so its monoid receives
the children's `Result`s as ordinary values, and a unit monoid over those
would discard precisely the failures this section exists to keep.

### Tasks

- [ ] Wait for [node-module-layering](./node-module-layering.md) to move
      `All`/`all`/`both` **and `allOk`** to `fjs/effects/all/module.f.mjs`.
      `allVoid` is built on `allOk`, so moving one without the other inverts
      the layering.
- [ ] Wait for [all-argument-limit](./all-argument-limit.md)'s list-shaped
      `allOk`, and hand it the list: `allVoid` is an arbitrary-length
      fan-out, so a spread in its body would rebuild the argument ceiling it
      is called at (the note under the proposal).
- [ ] Add `allVoid` there (next to `all`/`both`) with proof coverage — **not**
      to `fjs/effects/node/module.f.mjs`, per the note at the top of this issue.
- [ ] Convert the three `mapStep(allOk(...), () => undefined)` call sites in
      `fjs/emergent_testing/module.f.mjs`.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — the aggregating
  sibling; `allVoid` discards.
- `fjs/effects/module.f.mjs` — `forEachStep`, the sequential sibling.
