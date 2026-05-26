# 174. Computational collections in effects

## Current situation

`fs/dev/module.f.ts` — `loadModuleMap` — issues two sequential `all` effects:

```ts
return allFiles(s)
    .step(files => all(...files.map(loadFile)))
    .step(entries => ...)
```

The first `all` lists the directory; the second fans out one `loadFile` per
entry.  Because they are chained through `.step`, the runner sees them one at
a time and cannot reorder or batch them.

## Desired situation

Ideally the code would read as:

```ts
allFiles(s).flatMap(loadFile)
```

A sufficiently smart runner would then recognise that `flatMap` over an `all`
produces a flat collection of independent sub-effects and could schedule all
`loadFile` calls in one batch — issuing them in parallel (Node worker pool,
Deno parallel fetch, …) instead of sequentially.

## Relation to ALIQ

[ALIQ](https://github.com/aliq-lang/aliq) (Abstract Language Integrated Query)
explores exactly this idea: a set of abstract query operators (`SelectMany` /
`flatMap`, `GroupBy`, `Merge`, `Product`, `Input`) whose semantics are
defined independently of their execution strategy, so a runner can apply
algebraic optimisations such as fusion and batching transparently.

Applying the ALIQ philosophy here means:

- Add a `flatMap` (or `selectMany`) combinator to `Effect` so that
  `e.flatMap(f)` expresses "for each element produced by `e`, apply `f` and
  collect the results" without coupling it to a sequential execution order.
- Let the effect runner inspect this structure and decide whether to run the
  inner effects in parallel, batch them into a single system call, etc.

## Related but separate: `all` accepting `List`

`all` currently takes a variadic spread of effects, which forces the caller to
materialise the full array before constructing the effect.  Accepting a lazy
`List<Effect<O, T>>` (from `fs/types/list/module.f.ts`) would let a runner
consume elements on demand and avoid the intermediate array.  This is a
prerequisite improvement but is tracked separately.

## Implementation options

1. **Extend `Effect` directly** — add `flatMap` / `selectMany` to the `Effect`
   interface so runners can inspect and optimise the structure.

2. **ALIQ as a separate layer** — implement ALIQ operators independently of
   `Effect`.  The ALIQ layer can be built *on top of* Effects (each operator
   compiles down to an `Effect` chain at interpretation time) or it can treat
   Effects as one of several possible backends, with other backends such as
   async iterators or Rx streams.  This keeps the two abstractions decoupled
   and lets ALIQ evolve without touching the `Effect` / `Operation` interfaces.

Option 2 is lower risk: the Effects system stays stable while the ALIQ layer
is developed and validated independently.

## Open questions

- Is `flatMap` the right primitive, or should `all` itself accept a lazy
  `List` so the runner can stream-schedule it?
- If ALIQ is a separate layer, what is the exact interface for the Effects
  backend — a function `aliqToEffect<O>(q: Query<T>): Effect<O, T>`?
- What is the right relationship between ALIQ operators and the existing
  `All` effect type?
