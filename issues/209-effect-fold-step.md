# 209. `effects`: a state-threading `foldStep` combinator for sequential effects

**Priority:** P3
**Status:** open

Three call sites in the repo build the same shape: take an array (or list) of
items, thread a state value through each one by stepping an effect, and end
with a single `Effect<O, S>`. Two of them spell it as
`array.reduce((acc, item) => acc.step(s => f(item)(s)), pure(init))`; the
third hand-rolls it with a mutable `let` and a `for` loop.

```ts
// fs/dev/tf/module.f.ts:168-172
return modules.reduce(
    (acc: Effect<O | All, TestState>, [k, v]) => acc.step(runModule(reporter)(k, v)),
    pure({ time: 0, pass: 0, fail: 0 })
)
```

```ts
// fs/djs/transpiler/module.f.ts:58-60
return pathsArray.reduce<Effect<ReadFile, ParseContext>>(
    (acc, p) => acc.step(ctx => foldNextModuleOp(p)(ctx)),
    pure(contextWithStack),
)
```

```ts
// fs/cas/module.f.ts:147-156   — mutable, with a TODO
.step(v => {
    // TODO: make it lazy.
    let i: Effect<NodeOp, void> = begin
    for (const j of v) {
        const prev: Effect<NodeOp, void> = i
        i = begin
            .step(() => prev)
            .step(() => log(vecToCBase32(j)))
    }
    return i
})
```

All three express:

> Given items `[x₀, x₁, …]` and a function `f: (x, s) => Effect<O, S>`, run
> `f(x₀, init).step(s₀ => f(x₁, s₀)).step(s₁ => f(x₂, s₁)).…`

The `cas` version is a `void` accumulator (no state), so the `f` only needs
the item; the `dev/tf` and `djs/transpiler` versions thread real state.

## Proposed abstraction

Define a single combinator next to `all`/`begin` in
`fs/types/effects/module.f.ts` (or `effects/node` if it grows operation
dependencies):

```ts
// fs/types/effects
export const foldStep =
    <O extends Operation, T, S>(
        f: (item: T, state: S) => Effect<O, S>,
    ) =>
    (init: S) =>
    (items: readonly T[]): Effect<O, S> =>
    items.reduce<Effect<O, S>>(
        (acc, item) => acc.step(s => f(item, s)),
        pure(init),
    )
```

And a void-accumulator convenience over the same shape (the `cas` case):

```ts
export const forEachStep =
    <O extends Operation, T>(
        f: (item: T) => Effect<O, void>,
    ) =>
    (items: readonly T[]): Effect<O, void> =>
    foldStep<O, T, void>((item, _) => f(item))(undefined)(items)
```

Naming follows the existing FP vocabulary: `fold` already names the
state-threading list combinator in `fs/types/list/module.f.ts`, and `step`
is the existing `Effect` method this combinator threads through. Compare to
`all` (parallel, no state) — `foldStep` is the sequential, state-threading
sibling.

After:

```ts
// fs/dev/tf/module.f.ts
return foldStep<O | All, Entry<unknown>, TestState>(
    ([k, v], ts) => runModule(reporter)(k, v)(ts),
)({ time: 0, pass: 0, fail: 0 })(modules)
```

```ts
// fs/djs/transpiler/module.f.ts
return foldStep<ReadFile, string, ParseContext>(
    (p, ctx) => foldNextModuleOp(p)(ctx),
)(contextWithStack)(pathsArray)
```

```ts
// fs/cas/module.f.ts — kills the let-loop and addresses the TODO
.step(forEachStep<NodeOp, Vec>(j => log(vecToCBase32(j))))
.step(() => pure(0))
```

## Why this qualifies

- DRY across **three** real consumers with the same algorithmic shape —
  two using `reduce`, one using a mutable loop. Past the second-consumer
  bar in `AGENTS.md`.
- Removes the `let`-and-`for` pattern in `cas` (and the accompanying
  `TODO: make it lazy`), which violates `AGENTS.md`'s no-mutation rule.
- Removes the awkward `reduce<Effect<O, S>>(...)` type annotation that the
  two existing sites must spell out; the combinator types it once at the
  definition site.
- Reads as the operation it is — "fold these items, stepping the effect"
  — rather than as `reduce` over an opaque accumulator.

## Caveats

- This is the **sequential** sibling of `all`. The runner has no chance to
  batch or parallelise; each step depends on the previous state. That is
  the correct semantics for all three current consumers (test state must
  thread in order, the transpiler's `complete` map and `stack` must thread
  in order, log output must be ordered) — but it is the opposite of what
  [i182](./182-batch-load-effects.md) wants for independent sub-effects.
  The two combinators serve different needs; do not pick one over the
  other.
- The combinator works over `readonly T[]`. A lazy `List<T>` variant
  (matching `fs/types/list`) is straightforward but should wait for the
  second consumer that actually needs laziness — the current three are all
  array-driven.
- `cas`'s site builds a `Effect<NodeOp, void>` and then chains
  `.step(() => pure(0))`. `forEachStep` returns `Effect<O, void>` so the
  exit-code step stays on the caller side — the helper does not encode
  the CLI exit convention.
- Type inference for the `foldStep` form depends on the runner being able
  to widen `O` from the inner `f`'s effect type. The current call sites
  pass explicit type parameters in their `reduce<...>(...)`; the helper
  should keep the explicit-parameter ergonomics rather than try to infer
  `O` from `f` alone.

## Related

- [i182](./182-batch-load-effects.md) — `flatMap` for independent
  sub-effects (parallel/batched). `foldStep` is the explicitly **sequential**
  primitive; they coexist and pick different schedulers.
- [i192](./192-error-exit-effect.md), [i176](./176-json-file-effects.md),
  [i198](./198-utf8-file-effects.md) — same spirit of lifting recurring
  effect idioms into shared combinators.
- `fs/types/effects/module.f.ts` `all`/`begin`/`pure` — the existing
  combinator vocabulary `foldStep` joins.
