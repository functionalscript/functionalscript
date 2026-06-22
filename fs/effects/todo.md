# TODO

## `allReduce` combinator

**Priority:** P3
**Status:** open

### Problem

`foldStep` threads state through items **sequentially** — each step depends on the previous state. But many call sites only need to **aggregate** per-item results at the end, not maintain ordering between items.

When ordering doesn't matter, sequential threading is the wrong default: it blocks the runner from batching independent sub-effects (see computational collections issue above) and forces the threaded state to model "what has been seen so far".

The pattern `all(...xs.map(f)).step(rs => pure(rs.reduce(op, init)))` — fan out with `all`, fold results with a monoid — is the natural parallel sibling of `foldStep` and deserves a named combinator.

### Proposal

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

`op` must be **commutative** — results may arrive in any order when the runner schedules sub-effects in parallel.

After adding `allReduce`, `runModuleMap` in `fs/emergent_testing/module.f.ts` simplifies to:

```ts
return allReduce
    (([k, v]: Entry<unknown>) => runModule(reporter)(k, v)(zero))
    (mergeState)
    (zero)
    (modules)
```

### Naming

`allReduce` reads as "run `all`, then `reduce`". Alternatives: `allFold`, `forkFold`, `gather`, `mapAllReduce`. Should match the existing vocabulary (`all`, `begin`, `pure`, `foldStep`, `forEachStep`).

### Related

- `foldStep` / `forEachStep` — the sequential sibling.
- Computational collections issue above — `allReduce` is the result-aggregating variant.
- `fs/types/monoid/module.f.ts` — if `allReduce` takes a `Monoid<R>` it composes naturally with existing monoid definitions.
- #885 review — origin of this issue.

---

## Computational collections in effects

**Priority:** P3
**Status:** open

### Current situation

`fs/dev/module.f.ts` — `loadModuleMap` — issues two sequential `all` effects:

```ts
return allFiles(s)
    .step(files => all(...files.map(loadFile)))
    .step(entries => ...)
```

The first `all` lists the directory; the second fans out one `loadFile` per entry. Because they are chained through `.step`, the runner sees them one at a time and cannot reorder or batch them.

### Desired situation

```ts
allFiles(s).flatMap(loadFile)
```

A sufficiently smart runner would recognise that `flatMap` over an `all` produces a flat collection of independent sub-effects and could schedule all `loadFile` calls in one batch (parallel Node worker pool, Deno parallel fetch, etc.).

### Relation to ALIQ

[ALIQ](https://github.com/aliq-lang/aliq) explores exactly this idea: abstract query operators (`SelectMany`/`flatMap`, `GroupBy`, `Merge`, `Product`, `Input`) whose semantics are defined independently of their execution strategy.

- Add a `flatMap` (or `selectMany`) combinator to `Effect`.
- Let the effect runner inspect this structure and decide whether to run inner effects in parallel, batch them, etc.

`reduce` pairs naturally with `flatMap`: `flatMap` fans out, `reduce` aggregates — classic map-reduce:

```ts
allFiles(s).flatMap(loadFile).reduce(merge, empty)
```

### Implementation options

1. **Extend `Effect` directly** — add `flatMap`/`selectMany` to the `Effect` interface.
2. **ALIQ as a separate layer** — implement ALIQ operators independently of `Effect`, either compiling down to an `Effect` chain or treating Effects as one of several backends (async iterators, Rx streams). Lower risk: the Effects system stays stable while ALIQ evolves.

### Related

- `all` currently takes a variadic spread; accepting a lazy `List<Effect<O, T>>` would let a runner consume elements on demand (tracked separately).
- Async iterators (`AsyncIterable<T>`) are a natural third backend alongside Effects and plain arrays.

### Open questions

- Is `flatMap` the right primitive, or should `all` itself accept a lazy `List`?
- If ALIQ is a separate layer, what is the exact interface for the Effects backend?
- What is the right relationship between ALIQ operators and the existing `All` effect type?

---
