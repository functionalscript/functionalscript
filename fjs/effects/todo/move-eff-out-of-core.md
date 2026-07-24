## Extract `Eff` into a self-contained `eff/module.f.ts` monad layer

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/module.f.ts` is the home of the effect *model*: the `Effect` /
`Pure` / `Do` / `Cont` types, the `step` primitive, the single shape inspector
`decode` (plus `match`), the `do_` / `doFull` constructors, and the core
combinators (`foldStep`, `forEachStep`, `okStep`). Its module doc states the
contract in one line — *"Exactly one function inspects the shape: `decode`"* —
and positions `step` as the composition primitive.

`eff` / `Eff` are a different kind of thing. They are the **ergonomic layer**
over `step`: a fluent, method-chaining wrapper that adds nothing to the effect
algebra and is a pure *consumer* of the public API. The core module never
references `eff`; the dependency is entirely one-directional. Yet the wrapper
currently lives inside the core module, mixing "what the effect model *is*" with
"one convenient way to *write* it," and it is currently only a *thin* wrapper —
its `.step` takes a continuation returning a **raw** `Effect`, so every wrapped
site still threads raw effects through and unwraps with `.value` at each turn.
The codebase composes through `eff` almost everywhere (156 call sites across 23
files), so both the layering and the wrapper's shape are worth revisiting
together.

### Decision

1. **`Eff.step` accepts a continuation that returns `Eff`** (not a raw
   `Effect`). This makes `Eff` a proper monad — `pure` is unit, `.step` is bind,
   `.value` is the exit — where a chain never leaves the wrapped world until the
   final `.value`.
2. **The new module exports its own `pure` that returns `Eff`.** It is the
   monad's unit, so leaf continuations (`t => pure(x)`, the common case) stay in
   the `Eff` world with no wrapping.

The guiding principle: **a module picks one vocabulary — raw effects *or* the
`Eff` wrapper — and does not mix them.** A raw-style module uses `pure` / `step`
from core and composes with `step(step(…))`; an `Eff`-style module uses `pure` /
`eff` from `eff/module.f.ts` and composes with `.step(…)`, touching a raw
`Effect` only at the sanctioned boundaries (wrapping an operation with `eff(op)`
on the way in, `.value` on the way out).

This is why `.step` takes `t => Eff` rather than accepting *either* `Effect` or
`Eff` (a polymorphic `t => Effect | Eff` was considered): accepting both would
*encourage* mixing the two vocabularies inside one module, which is exactly what
this convention discourages. The stricter `t => Eff` signature makes a module's
choice of style visible and self-consistent.

3. **`Eff` is optional — users may bring their own chain wrapper.** The effect
   model's contract is the raw `Effect` type plus `step` (and `decode` /
   `match`); `Eff` is *one* wrapper over that contract, not part of it. Keeping
   it in a separate module makes that explicit: a downstream consumer who wants
   different ergonomics — a different fluent API, a pipe operator, do-notation
   codegen, or integration with their own effect utilities — writes their own
   wrapper over the same public `step` / `Effect` and never imports ours (and
   pays nothing for it). Leaving `eff` inside the core module would implicitly
   bless one chaining style as privileged; extracting it keeps the core a
   neutral primitive that any wrapper — ours or theirs — sits on top of. This is
   the same reason the raw `Effect`, not `Eff`, is the type that flows through
   interpreters and the public API.

### Proposal

Create `fjs/effects/eff/module.f.ts` as the self-contained `Eff` layer and
migrate the wrapper's call sites to the pure-`Eff` style.

**Name: `fjs/effects/eff/module.f.ts`** — matches the exported `eff` / `Eff` /
`pure`, the way `fjs/effects/list` exports `List`, and slots beside the existing
`list` / `memory` / `mock` / `node` submodules. (Role-describing alternatives —
`chain`, `fluent`, `builder` — read fine at the import but no longer match the
`eff` symbol, so discovery is slightly worse. Recommendation stands on `eff`.)

### Design

The module is small and has a single upward dependency on the core:

```ts
// fjs/effects/eff/module.f.ts
import { step, pure as pureEffect, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect}. `.step(f)` is
 * bind — `f` returns another `Eff`, so `.step(f).step(g)` chains and a chain
 * stays in the `Eff` world throughout — and `.value` is the exit back to a raw
 * `Effect`. An `Eff` is **not** assignable to `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Eff<Q, R>) => Eff<O | Q, R>
}

/** Wraps a raw {@link Effect}; the bridge *into* the `Eff` world. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> => ({
    value,
    // `.step` unwraps the continuation's `Eff` internally, so callers never
    // touch `.value` mid-chain.
    step: f => eff(step(value, t => f(t).value)),
})

/** The monad unit: a pure value as an `Eff`. The `Eff`-world `pure`. */
export const pure = <T>(v: T): Eff<never, T> => eff(pureEffect(v))
```

No dependency cycle: `eff/module.f.ts` imports from `../module.f.ts`, and the
core imports nothing back. The core `pure` is imported as `pureEffect` because
the module exports its own `pure`.

### Migration

This is larger than an import repoint, because `.step`'s new signature changes
what continuations must return. Per file (23 of them):

- **Decide the module's style.** Files that already chain with `eff` throughout
  are `Eff`-style; keep them wrapped. A file with only one or two incidental
  `eff` uses may read better rewritten raw-style — convert it the other way and
  drop the `eff` import entirely.
- **In `Eff`-style modules, move continuations into the `Eff` world:**
  - leaf `t => pure(x)` — switch `pure` to the module's `Eff`-`pure` (import
    from `eff/module.f.ts`); it now returns `Eff`, no wrap.
  - nested `t => eff(a).step(b).value` — drop the trailing `.value`; the
    continuation now returns `Eff` directly.
  - `.value` / `eff(...)` survive **only at the boundaries to the raw world**:
    the module's outermost result when it is typed `Effect`, a runner argument,
    and any raw core combinator that still takes a raw `Effect` continuation
    (`foldStep` / `forEachStep` / `all` / `both`, and `okStep` adapters).
- **Enforce one vocabulary per module via imports:** an `Eff`-style module
  imports `pure` / `eff` from `eff/module.f.ts` and must *not* also import raw
  `pure` / `step` from core (a lint-visible signal that the styles aren't
  mixed).

`tsc` verifies each file end to end, as with the earlier `eff` rollout.

### Design decisions

- **Bind over `Eff`, not accept-both.** Chosen to keep each module in one
  vocabulary (see Decision). The cost is that raw-world boundaries (core
  combinators, operations, `Effect`-typed returns) still need an explicit
  `eff(...)` in / `.value` out — accepted, and localized to those boundaries.
- **Core combinators stay raw.** `foldStep` / `forEachStep` / `all` / `both` /
  `okStep` remain in the raw layer and are bridged with `eff(...)` / `.value`.
  Providing `Eff`-flavored siblings so `Eff`-style modules never bridge is a
  possible follow-up, out of scope here.
- **Clean move, not a re-export.** The repo convention is explicit per-module
  imports, not barrel re-exports, so do *not* keep a compatibility
  `export { eff, pure } from './eff/module.f.ts'` in the core module — update the
  call sites instead. One home per symbol.
- **`step` stays in core.** Only the fluent layer moves; the `step` primitive
  remains the foundation in `fjs/effects/module.f.ts`, used internally there and
  exercised directly by the core proof.
- **Counter-precedent acknowledged.** `fjs/types/function/module.f.ts` keeps
  `compose` (primitive) and `fn` (fluent chainer) in the *same* module — the
  precedent `eff` was modeled on. This diverges for effects because the core
  effects module carries far more than a two-line primitive, so the split earns
  its own file here; giving `fn` the same treatment is a reasonable follow-up,
  out of scope.

### Tasks

- [ ] Create `fjs/effects/eff/module.f.ts` exporting `Eff`, `eff`, and the
      `Eff`-returning `pure` (importing `step` / core `pure` / `Effect` /
      `Operation` from `../module.f.ts`).
- [ ] Remove `Eff` / `eff` from `fjs/effects/module.f.ts`; keep the doc pointer
      to the new module.
- [ ] Migrate the 23 wrapper call-site files to the pure-`Eff` style:
      continuations return `Eff`, leaf `pure` comes from the new module, `.value`
      / `eff(...)` only at raw-world boundaries; repoint imports.
- [ ] Move the `eff` proof cases into `fjs/effects/eff/proof.f.ts` (including a
      case for `Eff`-`pure` and a `t => Eff` continuation); leave the `step`
      cases in `fjs/effects/proof.f.ts`.

### Related

- `fjs/effects/module.f.ts` — current home of `step` (primitive), `pure`, `eff`
  (to move), `decode` / `match`, and the core combinators.
- `fjs/types/function/module.f.ts` — `compose` / `fn` precedent (the
  counter-precedent above).
- `fjs/effects/list`, `fjs/effects/memory`, `fjs/effects/mock`,
  `fjs/effects/node` — sibling submodules the new `eff` module joins.
