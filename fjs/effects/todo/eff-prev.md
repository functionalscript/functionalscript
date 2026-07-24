## eff-prev. Retain the previous result in fluent Effect chains

**Priority:** P3
**Status:** open

### Problem

Raw `step` composition becomes nested when a later operation needs both the
current result and the result that preceded it:

```ts
return step(
    operation0(),
    result0 => step(
        operation1(result0),
        result1 => operation2(result0, result1),
    ),
)
```

`Eff` already provides a flatter authoring form, but its current `.step`
callback receives only the current result:

```ts
return eff(operation0())
    .step(result0 => operation1(result0))
    .step(result1 => {
        // result0 is no longer available here.
    })
    .value
```

This forces convenient chains back into nested raw `step` expressions or makes
callers manually include earlier values in intermediate results.

### Design direction

Treat the two APIs as different abstraction levels:

- `Effect` and the standalone `step` function are the minimal primitives for
  code that needs explicit control over retained values and allocations.
- `Eff` is a lazy, fluent authoring representation for readable effect chains.
  It may retain limited composition context to make common chains easier to
  write.
- `.value` exits the fluent representation and returns a raw `Effect` containing
  only the current result.

Constructing an `Eff` or extending it with `.step` must not execute any
operation. It only builds a lazy effect description.

### Proposal

Extend `Eff` with the immediately preceding result type. Expose the preceding
result through `.prev`, and pass it as the second argument of the next `.step`
callback:

```ts
export type Eff<
    O extends Operation,
    T,
    P = never,
> = {
    readonly value: Effect<O, T>
    readonly prev: [P] extends [never]
        ? undefined
        : Effect<O, P>

    readonly step: <Q extends Operation, R>(
        f: (
            value: T,
            prev: P,
        ) => Effect<Q, R> | Eff<Q, R>,
    ) => Eff<O | Q, R, T>
}
```

`never` is the type-level marker for an `Eff` that does not yet have a previous
result. A unary callback remains the normal form for its first step:

```ts
const initial = eff(operation0())
// Eff<O0, Result0, never>
// initial.prev === undefined

const next = initial.step(result0 => operation1(result0))
// Eff<O0 | O1, Result1, Result0>
```

After a step, the old current result becomes the new previous result:

```ts
const effect = eff(operation0())
    .step(result0 => operation1(result0))
    .step((result1, result0) =>
        operation2(result0, result1))
    .value
```

The callback argument order is `(value, prev)`:

- the current result remains the primary first argument;
- existing unary callbacks remain unchanged;
- the previous result is available only when requested by the callback.

The resulting type shifts on every step:

```ts
Eff<O0, Result0, never>
    -> Eff<O0 | O1, Result1, Result0>
    -> Eff<O0 | O1 | O2, Result2, Result1>
```

Only the immediately preceding result is retained. `Eff` does not implicitly
build a recursive history:

```ts
const chain = eff(operation0())
    .step(operation1)
    .step(operation2)

// chain.value: Effect<..., Result2>
// chain.prev:  Effect<..., Result1>
// Result0 is no longer retained by the resulting Eff.
```

Callers that need more history can deliberately make it part of the current
result. This keeps the default retention rule small and predictable.

### `.value` and `.prev`

`.value` is the boundary back to the minimal representation:

```ts
const effect = eff(operation0())
    .step(operation1)
    .value

return step(effect, operation2)
```

Once the chain exits through `.value`, later raw `step` calls do not retain an
additional previous result unless the caller explicitly closes over it.

`.prev` exposes the previous result as a lazy raw `Effect`; it is `undefined`
before the first fluent step. The implementation must derive `.value` and
`.prev` from shared internal chain state so that one `.step` continuation does
not evaluate preceding operations twice.

Neither property is a memoized executed value. Running `.value` and `.prev` as
separate top-level effects may execute their effect descriptions separately,
just as running any raw effect twice may perform its operations twice.

### Implementation constraints

The internal representation is not part of the public API. It may use a private
pair such as:

```ts
type EffState<P, T> = {
    readonly prev: P
    readonly value: T
}
```

or a lazy linked chain that is lowered when `.value`, `.prev`, or another
`.step` is requested.

Regardless of representation:

1. a fluent `.step` must run its preceding chain once;
2. its callback receives the current result and the immediately preceding
   result;
3. the returned `Eff` retains the old current result as its new `.prev`;
4. `.value` exposes only the new current result as a raw `Effect`;
5. callbacks may continue returning either a raw `Effect` or another `Eff`.

### Performance model

`Eff` is the convenience API and does not promise zero-cost composition. An
implementation may allocate an internal pair and keep the previous result alive
until the following step completes.

Code that needs guaranteed minimal retention should use standalone `step`:

```ts
step(
    operation0(),
    result0 => operation1(result0),
)
```

A caller may also exit a convenient chain early with `.value` and continue with
raw `step`. This prevents subsequent fluent steps from automatically retaining
another previous result. Eliding overhead already introduced inside an `Eff`
chain is an optional implementation or compiler optimization, not a semantic
requirement of this proposal.

### Non-goals

- Do not add a standalone `stepFrame` combinator.
- Do not expose an accumulated recursive frame history by default.
- Do not add methods directly to the raw `Effect` representation.
- Do not add implicit memoization or cache executed effect results.
- Do not claim that `Eff` has the same allocation or retention behavior as a
  manually optimized raw `step` expression.
- Do not add `do` notation or `async`/`await`-like syntax.

### Tasks

- [ ] Extend `Eff` with a previous-result type parameter and `.prev`.
- [ ] Update `.step` to pass `(value, prev)` and return `Eff<O | Q, R, T>`.
- [ ] Preserve support for callbacks returning either `Effect` or `Eff`.
- [ ] Implement shared internal state without evaluating a preceding chain twice
      within one fluent step.
- [ ] Add proof coverage for the initial absent `.prev`, result shifting,
      operation-set widening, callbacks returning `Effect` and `Eff`, and
      effects whose result is `undefined`.
- [ ] Update the `Eff` documentation to describe it as the lazy convenience
      layer and raw `step` as the optimization-oriented primitive.
- [ ] Convert at least one existing nested context-retention chain, preferably
      `gcStage` in `fjs/cas/module.f.ts`, to demonstrate the intended syntax.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [`fjs/effects/module.f.ts`](../module.f.ts) — raw `Effect`, standalone `step`,
  and the minimal effect combinators.
- [`fjs/effects/eff/module.f.ts`](../eff/module.f.ts) — the fluent wrapper to be
  extended by this proposal.
- [`fjs/cas/module.f.ts`](../../cas/module.f.ts) — contains existing nested
  chains that retain earlier effect results.
