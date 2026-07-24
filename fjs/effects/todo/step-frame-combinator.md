## step-frame-combinator. Preserve prior Effect results across flat chains

**Priority:** P3
**Status:** open

### Problem

`step` passes only the immediately preceding result to its continuation. When a
later operation needs both that result and an earlier one, raw `Effect`
composition must keep the earlier value in lexical scope, which creates nested
expressions:

```ts
return step(
    operation0(),
    result0 => step(
        operation1(result0),
        result1 => operation2(result0, result1),
    ),
)
```

A temporary binding cannot move `result0` outside its continuation. The chain
can be flattened only by explicitly returning the retained context as the
intermediate effect result:

```ts
const frame = step(
    operation0(),
    result0 => step(
        operation1(result0),
        result1 => pure({ prev: result0, result: result1 }),
    ),
)

return step(
    frame,
    ({ prev: result0, result: result1 }) => operation2(result0, result1),
)
```

This pattern is useful independently of the `eff` method-chaining wrapper. It
should remain a raw `Effect`-to-`Effect` transformation and must not introduce a
second effect representation or a wrapper object with methods.

The same context-retention problem already appears in real code. For example,
`gcStage` in `fjs/cas/module.f.ts` keeps the result of `now()` in scope while it
runs `readdir()` and then uses both values to select expired files.

### Proposal

Add a named immutable frame and a data-first `stepFrame` combinator to
`fjs/effects/module.f.ts`:

```ts
export type Frame<P, R> = {
    readonly prev: P
    readonly result: R
}

export const stepFrame = <
    O extends Operation,
    P,
    Q extends Operation,
    R,
>(
    effect: Effect<O, P>,
    next: (prev: P) => Effect<Q, R>,
): Effect<O | Q, Frame<P, R>> =>
    step(
        effect,
        prev => step(
            next(prev),
            result => pure({ prev, result }),
        ),
    )
```

Usage:

```ts
const frame = stepFrame(
    operation0(),
    operation1,
)

return step(
    frame,
    ({ prev: result0, result: result1 }) =>
        operation2(result0, result1),
)
```

Use an object rather than a tuple because `prev` and `result` describe the roles
of the two values without requiring callers to remember an ordering convention.
The name `Frame` also reflects that the value is an explicit retained execution
context, not merely an arbitrary pair.

`stepFrame` remains sequential and has the same operational behavior as the
nested `step` expression. It runs `effect`, passes its result to `next`, then
returns both values as ordinary immutable data. It does not inspect the
`Effect` representation directly and should be implemented only in terms of
`step` and `pure`.

Frames may be accumulated recursively:

```ts
const frame01 = stepFrame(
    operation0(),
    operation1,
)

const frame012 = stepFrame(
    frame01,
    ({ prev: result0, result: result1 }) =>
        operation2(result0, result1),
)
```

The resulting value has the structural type:

```ts
Frame<Frame<Result0, Result1>, Result2>
```

Each additional step adds one frame node instead of copying all earlier values.
Callers can destructure the nested frame only as deeply as needed.

The module-level documentation currently says that all helpers are step
adapters and never take an effect as an argument. Update that rule to distinguish
three concepts:

- **Step adapters** transform a continuation and are passed to `step`.
- **Raw effect combinators**, such as `step` and `stepFrame`, accept and return
  raw `Effect` values.
- **Wrappers**, such as `Eff`, introduce another representation around an
  effect.

`stepFrame` is a raw combinator, not a wrapper. Adding it should not require or
encourage using `Eff`.

### Non-goals

- Do not replace or extend the `Eff` wrapper.
- Do not add methods to `Effect` or `Frame`.
- Do not add variadic tuple accumulation or a generalized dynamic environment.
- Do not flatten recursive frames by copying all retained values into a new
  object or array.
- Do not add syntax resembling `do` notation or `async`/`await` in this task.

### Tasks

- [ ] Add `Frame<P, R>` and `stepFrame` to `fjs/effects/module.f.ts` with JSDoc.
- [ ] Update the module documentation to distinguish adapters, raw combinators,
      and wrappers.
- [ ] Add proof coverage for pure effects, `Do` effects, operation-set widening,
      and recursively accumulated frames.
- [ ] Convert at least one existing nested context-retention chain, preferably
      `gcStage` in `fjs/cas/module.f.ts`, to demonstrate the intended use.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [`fjs/effects/module.f.ts`](../module.f.ts) — raw `Effect`, `step`, and core
  combinators.
- [`fjs/effects/eff/module.f.ts`](../eff/module.f.ts) — the separate fluent
  wrapper that this proposal intentionally does not require.
- [`fjs/cas/module.f.ts`](../../cas/module.f.ts) — contains existing nested
  chains that retain earlier effect results.
