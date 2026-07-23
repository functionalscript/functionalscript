## Replace the `step` method with an external `step` function

**Priority:** P2
**Status:** open

### Problem

Every `Effect` instance carries a `step` method whose implementation dispatches
on whether the effect is pure or impure:

- `pure` / `lazy` — `step: f => f(t())` (`fjs/effects/module.f.ts`)
- `doFull` — `step` rebuilds a `Do` node wrapping the continuation
- `decode` — the `typeof value === 'function'` shape check

That is the pure/impure dispatch encoded in **three** places. The doc comment
on `decode` claims it is "the only function that knows how `Value` is laid
out" — the constructors' `step` closures already contradict it. An external
`step` built on the same shape analysis as `decode` restores a single source
of truth.

The method also bakes one blessed composition API into every instance. With an
external function the core contract shrinks to the data type plus `decode`,
and every composition flavor becomes userland — users (or the library) can
provide `step(b, f)`, a curried `step(f)(b)`, or an `fn`-style chainer
`eff(b).step(f)`, each a thin wrapper over the one primitive. This mirrors
`fjs/types/function`: `compose` is the primitive, `fn` is optional sugar.

Once the method is gone the wrapper object has no reason to exist:
`Effect<O, T>` collapses to `Value<O, T>` — a thunk or a
`[command, payload, continuation]` tuple, plain data, one less allocation per
node. That also matches the house style: `fold`, `map`, `decode`, `match` are
all external functions; the `step` method is the outlier. Interpreters already
go through `decode` / `match` exclusively, so only program-construction code
is affected.

### Proposal

```ts
export const step = <O extends Operation, T, Q extends Operation, R>(
    e: Effect<O, T>,
    f: (t: T) => Effect<Q, R>
): Effect<O | Q, R> => { ... }
```

Then chains become explicit sequencing:

```ts
// before
const r = b.step(f).step(g)

// after
const b0 = step(b, f)
const r = step(b0, g)
```

Migration can be incremental:

1. Add the external `step` (delegating to the method at first, or shape-based).
2. Migrate call sites file by file — ~161 `.step(` sites across 25 files,
   including `List<O, T>` stream code and the core's own `foldStep`.
3. Delete the method and collapse `Effect` to `Value` in one final commit —
   the payoff commit that actually removes the duplicated dispatch.

### Design decisions

- **Data-first for the library's own call sites.** `step(b, f)` lets
  TypeScript contextually type the lambda parameter from the effect — the
  common case at existing call sites. A curried data-last `step(f)(b)` infers
  `f` before seeing the effect, forcing parameter annotations on anonymous
  lambdas; it is still the right shape for point-free code where the
  continuation is a named adapter (`okStep`), so it can ship alongside.
  Multi-arg has precedent (`doFull`, `nonEmpty`).
- **Exactly one function inspects the shape.** Every flavor must be a thin
  wrapper over the one primitive (`step` or `decode`). A second
  `typeof value === 'function'` check anywhere reintroduces the duplication.
  State this in the module doc as bluntly as the current "must not be
  extended with new methods" rule.
- **The step-adapter convention survives.** Helpers like `okStep` remain
  adapters, now passed as `step(e, okStep(f))`.
- **Readability is neutral, not a motivation.** Linear chains become const
  sequencing (more verbose, names the intermediates); deeply nested
  continuations (e.g. `put` in `fjs/cas/module.f.ts`) are nested because of
  data dependencies and stay nested either way.
- **No perf regression.** The external function wraps continuations exactly
  like `doFull.step` does today; the O(depth) cost of left-nested chains is
  unchanged, and dropping the wrapper object saves an allocation per node.

### Related

- `fjs/types/function/module.f.ts` — `compose` / `fn` precedent for
  "primitive + optional chainer".
- `fjs/effects/list/module.f.ts` — `List<O, T>` call sites migrate the same
  way (`s.step(f)` → `step(s, f)`).
- `decode` / `match` — already the interpreter-facing half of this contract.
