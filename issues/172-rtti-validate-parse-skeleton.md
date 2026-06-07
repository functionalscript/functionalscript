# 172. RTTI: investigate one container skeleton for both `validate` and `parse`

**Priority:** P3
**Status:** open

`fs/types/rtti/validate` and `fs/types/rtti/parse` each expose a factory pair
that walks the same container shapes:

- `containerValidate` / `containerParse` — value-driven walk of `array`/`record`.
- `constContainerValidate` / `constContainerParse` — schema-driven walk of
  `tuple`/`struct`.

After i162 the two modules are
structurally parallel: same container guards (`isArray`/`isObject` from
`common`), same `Object.entries` traversal, same error-path bookkeeping
(`prependPath`, first-error). The only real difference is the success result:

- `validate` returns the **original** value unchanged — no fresh allocation —
  and short-circuits on the first error.
- `parse` **rebuilds** a fresh value from each item's parsed result
  (`rebuild(okEntries(results))`), mapping every item first.

## The idea

Collapse the four factories into two shared skeletons in `common`, each taking
an injected `build` callback:

```ts
// build = (value, results) => Result
// validate injects:  (value, _)       => ok(value)        // identity
// parse    injects:  (_, results)     => ok(rebuild(...))  // transformed
const container      = <K extends Tag1>(isContainer, build) => ...
const constContainer = <C>(isContainer, getItem, build) => ...
```

`validate` and `parse` would then be `container(isArray, identityBuild)` etc.
Net: 4 factories → 2 shared factories, with the per-module behavior expressed
purely as a `build` injection. (Note `Parse<T> = Validate<T>`, so the two
already share one signature — the type side is free.)

## The catch

The two walks are not the *same* algorithm today:

1. **Allocation.** `validate`'s contract is "returns the original value on
   success — no fresh allocation" (documented in its module header). A naive
   unified skeleton that always builds a `results` array to hand to `build`
   would make `validate` allocate an intermediate it then throws away.

2. **Short-circuit.** `validate` exits the loop on the first error; `parse`
   maps *every* item, then finds the first error. A merge has to pick one.
   Short-circuiting both is arguably an improvement for `parse`, but it means
   the injected `build` has to be fed incrementally (a fold threading a
   `Result`) rather than a finished array — which is the fiddly part.

3. **Casts.** Both modules already lean on `as any` to bridge the schema-driven
   generics (historically tracked in i146). Routing through one
   more generic `build` callback is unlikely to remove casts and may add a few.

## The `getItem` parameter and TS array string-indexing

`constContainer*` takes a `getItem(value, k)` accessor that differs between the
two const shapes:

```ts
const tupleParse = constContainerParse<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)],  // tuple: string key → number index
    arrayRebuild,
)
const structParse = constContainerParse<ReadonlyRecord<string, Unknown>>(
    isObject,
    (value, k) => value[k],          // struct: string key directly
    arrayRebuild,
)
```

The split exists because the walk produces a **string** key (`Object.entries`
gives string keys for both arrays and objects), but TypeScript rejects indexing
an array with a string (`value[k]` where `k: string`) even though JavaScript
handles `arr['0']` fine. So the tuple branch round-trips through
`Number(k)` purely to satisfy the type checker.

We want a clean way to express "index this container by its entry key" that
works for both arrays and records **without** an `as` cast or the
`Number(k)` detour. Options to weigh:

- Keep the per-shape `getItem` injection (status quo): explicit, no cast, but
  asymmetric and a reason the tuple/struct factories can't fully merge.
- A small typed `at(container, key)` helper in `common`/`object` that accepts a
  string key and narrows internally (e.g. via `Object` index access) so callers
  never write the `Number(k)` conversion.
- Drive the tuple walk from numeric indices instead of `Object.entries` (so the
  key is already a `number` for arrays), and reconcile that with the record
  walk's string keys — at the cost of reintroducing the index/key split that
  i162 removed.

Whichever shared-skeleton design wins, it must settle this so a single
container accessor type-checks for arrays and records alike.

## Decision

Defer. The duplicated skeleton is ~15 readable lines per module; unifying it
trades that for a fold/`build` indirection plus a behavioral-semantics decision
(allocation + short-circuit) that a naive merge would paper over. The
abstraction clearly earns its keep once a **third** consumer of the same
container walk exists — most likely the serializable data form in
[i143](./143-rtti-data.md). Revisit then, designing the skeleton as a
short-circuiting `traverse` that lets the identity (`validate`) path avoid
allocation.

## Related

- i162 — made `parse` mirror
  `validate`'s factory pair (the precondition for this investigation).
- [i143](./143-rtti-data.md) — RTTI data form; the likely third consumer.
- i146 — the `Ts<T>` inference / `as any` problem both modules work around.
