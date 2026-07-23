## Computational collections in effects

**Priority:** P3
**Status:** open

### Current situation

`fjs/dev/module.f.ts` — `loadModuleMap` — issues two sequential `all` effects:

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
