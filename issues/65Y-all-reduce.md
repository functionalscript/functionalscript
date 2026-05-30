# 65Y-all-reduce. `allReduce` combinator: parallel sibling of `foldStep`

**Priority:** P3
**Status:** open

## Problem

`foldStep` (added in [i209](./209-effect-fold-step.md)) threads state through
items **sequentially** — each step depends on the previous state. But many
call sites don't actually need ordering between items; they only need to
**aggregate** the per-item results at the end.

When ordering doesn't matter, sequential threading is the wrong default:

- It blocks the runner from batching independent sub-effects (cf.
  [i182](./182-batch-load-effects.md)).
- It forces the threaded state to model "what has been seen so far" even
  when the final aggregation only needs the multiset of per-item results.

Concrete example: `runModuleMap` in `fs/dev/tf/module.f.ts` originally used
`foldStep` to thread a `TestState` through every module, but the per-module
runs are independent — each module produces its own `TestState`, and the
final answer is the monoid sum. It was changed (#885) to:

```ts
return all(...modules.map(([k, v]) => runModule(reporter)(k, v)(zero)))
.step(m => pure(m.reduce(mergeState, zero)))
```

This pattern — *fan out with `all`, fold the results with a monoid* —
appears whenever per-item effects are independent. It's the dual of
`foldStep` for order-insensitive aggregation, and it deserves a named
combinator.

## Proposal

Add a combinator next to `foldStep` / `forEachStep` /  `all` in
`fs/types/effects/module.f.ts`. Working name: `allReduce`. Other candidates:
`allFold`, `forkFold`, `gather`, `mapAll` — discuss.

```ts
export const allReduce =
    <O extends Operation, T, R>(
        f: (item: T) => Effect<O, R>,
    ) =>
    (op: (a: R) => (b: R) => R) =>
    (init: R) =>
    (items: List<T>): Effect<O | All, R> =>
        all(...toArray(items).map(f))
        .step(rs => pure(rs.reduce((a, b) => op(b)(a), init)))
```

Signature notes:

- `f` produces the per-item effect; `op`/`init` is a `Monoid<R>`-style
  reduction over the resulting array. (If we adopt `Monoid<R>` from
  `fs/types/monoid` here, the signature collapses to `(f)(monoid)(items)`.)
- Effect type widens with `All` because the implementation routes through
  `all`. This matches the existing `foldStep` site that returned `O | All`.
- Input is `List<T>` matching `foldStep`'s shape (#885 review).

After:

```ts
// fs/dev/tf/module.f.ts
return allReduce
    (([k, v]: Entry<unknown>) => runModule(reporter)(k, v)(zero))
    (mergeState)
    (zero)
    (modules)
.step(ts => summary(ts.pass, ts.fail, ts.time)
.step(() => pure(ts.fail !== 0 ? 1 : 0)))
```

## Naming

`allReduce` reads as "run `all`, then `reduce`", which describes the
implementation. But the higher-altitude reading is "fan out, then fold",
suggesting `forkFold` or `mapAllReduce`. The choice should match the
combinator vocabulary already in `effects/module.f.ts` (`all`, `begin`,
`pure`, `foldStep`, `forEachStep`).

## Why this qualifies

- DRY: the pattern `all(...xs.map(f)).step(rs => pure(rs.reduce(op, init)))`
  is the natural parallel sibling of `foldStep` and will accrue consumers
  once it exists (the `runModuleMap` site is the first; cf.
  [i182](./182-batch-load-effects.md) for batch-loading scenarios).
- Separation of concerns: lifts a recurring effect idiom into the shared
  combinator module rather than open-coding it at each call site.
- Aligns with the project's direction of growing `Effect`-based combinators
  in `fs/types/effects/module.f.ts` to replace ad-hoc IO patterns.

## Related

- [i209](./209-effect-fold-step.md) — `foldStep` / `forEachStep` (the
  **sequential** combinator); this is its order-insensitive sibling.
- [i182](./182-batch-load-effects.md) — `flatMap` for independent sub-effects
  (batched). `allReduce` is the result-aggregating variant: same parallel
  scheduling, plus a monoid reduction.
- `fs/types/monoid/module.f.ts` — if `allReduce` takes a `Monoid<R>` it
  composes naturally with existing monoid definitions.
- #885 review — origin of this issue.
