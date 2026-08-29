## `allReduce` combinator

**Priority:** P3
**Status:** open

### Problem

`foldStep` threads state through items **sequentially** — each step depends on the previous state. But many call sites only need to **aggregate** per-item results at the end, not maintain ordering between items.

When ordering doesn't matter, sequential threading is the wrong default: it blocks the runner from batching independent sub-effects (see computational collections issue above) and forces the threaded state to model "what has been seen so far".

The pattern `step(all(...xs.map(f)), rs => pure(rs.reduce(op, init)))` — fan out with `all`, fold results with a monoid — is the natural parallel sibling of `foldStep` and deserves a named combinator.

### Proposal

```ts
export const allReduce =
    <O extends Operation, T, R>(
        f: (item: T) => Effect<O, R>,
    ) =>
    (op: (a: R) => (b: R) => R) =>
    (init: R) =>
    (items: List<T>): Effect<O | All, R> =>
        step(
            all(...toArray(items).map(f)),
            rs => pure(rs.reduce((a, b) => op(b)(a), init)))
```

**The body must call the list-shaped operation directly once
[all-argument-limit](./all-argument-limit.md) lands** — the spread above is
exactly the unbounded-spread shape that issue exists to remove, and a
combinator built for arbitrarily long lists must not become another instance
of the ceiling. Until then the spread inherits the documented limit.

Note the standalone `step`: `all(...)` returns a raw `Effect`, which is plain
data with no methods, so `all(...).step(...)` — as an earlier draft of this
issue wrote it — would not compile. If
[map-step-combinator](./map-step-combinator.md) lands first, the body is
`mapStep(all(...toArray(items).map(f)), rs => rs.reduce(...))`.

`op` must be **commutative** — results may arrive in any order when the runner schedules sub-effects in parallel.

**`runModuleMap` is no longer a consumer.** An earlier draft of this issue
rewrote it with `allReduce`, and the sequential plan in
[share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
decides the opposite: the proof traversal runs one leaf's whole chain before
the next, deliberately, and fanning its modules back out would undo that
decision. The combinator's consumers are the sites that *want* fan-out — the
framework-registration path and `dev/module.f.mjs`'s file loading — and it
must not be applied to the traversal.

### Naming

`allReduce` reads as "run `all`, then `reduce`". Alternatives: `allFold`, `forkFold`, `gather`, `mapAllReduce`. Should match the existing vocabulary (`all`, `begin`, `pure`, `foldStep`, `forEachStep`).

### Related

- `foldStep` / `forEachStep` — the sequential sibling.
- Computational collections issue above — `allReduce` is the result-aggregating variant.
- `fjs/common/monoid/module.f.mjs` — if `allReduce` takes a `Monoid<R>` it composes naturally with existing monoid definitions.
- #885 review — origin of this issue.
