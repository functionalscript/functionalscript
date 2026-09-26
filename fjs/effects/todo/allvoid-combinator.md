## allvoid-combinator. `allVoid` combinator for parallel fan-out that discards results

**Priority:** P4
**Status:** blocked
**Blocked by:** [all-argument-limit](./all-argument-limit.md)

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

Add the void sibling next to `all` / `All` / `both` / `allOk`, in
`fjs/effects/common/module.f.mjs`, where
[node-module-layering](./node-module-layering.md) moved them. It cannot live
next to `forEachStep` in the core `fjs/effects/module.f.mjs`: `all`/`All` are
defined in a module that already imports the core one, so placing `allVoid` in
core would invert that dependency.

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

The body hands the *list-shaped* callable the list, not a spread: `allVoid`
exists for arbitrary-length fan-outs, which is exactly where
`allOk(...items.map(f))` would rebuild the engine argument ceiling
([all-argument-limit](./all-argument-limit.md)) inside the new combinator —
the same correction [allreduce-combinator](./allreduce-combinator.md)
carries. `allOk` in the sketch names that list-shaped operation under
all-argument-limit's naming rule: it is `allOk` itself if the variadic
wrapper is dropped, and the list-shaped sibling (`allOkList` in that issue's
sketch) if the wrapper keeps the published names — either way the body's
call shape is one array argument. That makes this issue's landing depend on
the list-shaped operation from that issue; until it lands, the spread
spelling is the only one that compiles, which is one more reason this issue
is scheduled after the `All` move rather than before it.

`NotImplemented` in the error channel is the runner's, inherited from `allOk`;
`E` is the children's. Written with the standalone `step` instead —
`step(allOk(items.map(f)), () => pureOk(undefined))` — it is the same effect
said less directly; either works. Note `pureOk`, not `pure`: `pure` takes a
`Result` (`pureOk = v => pure(ok(v))`), so `pure(undefined)` would yield a bare
`undefined` where the chain expects `ok(undefined)`. Both spellings must also
use the standalone combinators: `allOk(...)` returns a raw `Effect`, which has
no `.step` method.

**`allOk` moved with them**, which is what makes that placement work: an
`allVoid` built on an `allOk` left in `fjs/effects/node/module.f.mjs` would have
made the shared module import from `fjs/effects/node`, the inversion the
lowering exists to remove. `allOk` belongs there by the layering issue's own
test: it is `step(all(…), rs => pure(okList(rs)))`, concurrency plumbing with no
host API in it.

The three call sites become `allVoid(e => registerOne(t, e))(sub)` etc.
If [allreduce-combinator](./allreduce-combinator.md) lands first, consider
deriving `allVoid` from `allReduce` with a unit monoid instead of
duplicating the shared core — its proposal is now built on the list-shaped
`allOk`, so its monoid receives plain `R`s and the first failure travels the
error channel, which is exactly what a unit monoid needs. (An earlier sketch
of that issue folded over raw `all(...)`, whose monoid would have received
the children's `Result`s as ordinary values — a unit monoid over those would
discard precisely the failures this section exists to keep; that sketch is
recorded as superseded there.)

### Tasks

- [x] Wait for [node-module-layering](./node-module-layering.md) to move
      `All`/`all`/`both` **and `allOk`** to `fjs/effects/all/module.f.mjs`.
      `allVoid` is built on `allOk`, so moving one without the other inverts
      the layering. **Done** — all four moved together, to
      `fjs/effects/common/module.f.mjs` rather than the `effects/all` this task
      guessed at.
- [ ] Wait for [all-argument-limit](./all-argument-limit.md)'s list-shaped
      `allOk`, and hand it the list: `allVoid` is an arbitrary-length
      fan-out, so a spread in its body would rebuild the argument ceiling it
      is called at (the note under the proposal).
- [ ] Add `allVoid` to `fjs/effects/common/module.f.mjs` (next to
      `all`/`both`/`allOk`) with proof coverage.
- [ ] Convert the three `mapStep(allOk(...), () => undefined)` call sites in
      `fjs/emergent_testing/module.f.mjs`.
- [ ] Run `tsc` and `fjs t`.

### Related

- [allreduce-combinator](./allreduce-combinator.md) — the aggregating
  sibling; `allVoid` discards.
- `fjs/effects/module.f.mjs` — `forEachStep`, the sequential sibling.
