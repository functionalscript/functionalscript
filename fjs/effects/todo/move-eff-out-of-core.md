## Move the `eff` fluent wrapper out of `effects/module.f.ts`

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/module.f.ts` is the home of the effect *model*: the `Effect` /
`Pure` / `Do` / `Cont` types, the `step` primitive, the single shape inspector
`decode` (plus `match`), the `do_` / `doFull` constructors, and the core
combinators (`foldStep`, `forEachStep`, `okStep`). Its module doc states the
contract in one line — *"Exactly one function inspects the shape: `decode`"* —
and positions `step` as the composition primitive.

`eff` / `Eff` are a different kind of thing. They are **optional ergonomic
sugar** over `step`: a fluent, method-chaining wrapper (`eff(x).step(f).value`)
that adds nothing to the effect algebra and is a pure *consumer* of the public
API (`step`, plus the `Effect` / `Operation` types). The core module never
references `eff`; the dependency is entirely one-directional. Yet the wrapper
currently lives inside the core module, mixing "what the effect model *is*" with
"one convenient way to *write* it."

The codebase now composes effects through `eff` almost everywhere (156 call
sites across 23 files), which makes the layering worth making physical: the
primitive layer (`step`, the model) and the ergonomic layer (`eff`) deserve
separate homes, so a reader of the core module sees the algebra without the
sugar, and a reader of the sugar sees exactly what it is built on.

### Proposal

Move `eff` and its `Eff` type into a new submodule and update the import sites.

**Recommended name: `fjs/effects/eff/module.f.ts`.** It matches the exported
symbol (`eff` / `Eff`) exactly, the way `fjs/effects/list` exports `List`, and
it slots cleanly beside the existing `list` / `memory` / `mock` / `node`
submodules. Import sites read `import { eff, type Eff } from
'../effects/eff/module.f.ts'`.

Alternatives, if a role-describing name is preferred over an export-matching
one: `fjs/effects/chain` (names the method-chaining role), `fjs/effects/fluent`,
or `fjs/effects/builder`. These read fine at the import but no longer match the
`eff` symbol, so discovery ("where does `eff` live?") is slightly worse.
Recommendation stands on `eff`.

### Design

The new module is tiny and has a single upward dependency on the core:

```ts
// fjs/effects/eff/module.f.ts
import { step, type Effect, type Operation } from '../module.f.ts'

/**
 * The `fn`-style wrapper around a raw {@link Effect}, for optional
 * method-chaining. `.step(f)` returns another `Eff` (so `.step(f).step(g)`
 * chains) and `.value` unwraps back to the raw `Effect`. An `Eff` is **not**
 * assignable to `Effect`; unwrap at the boundary with `.value`.
 */
export type Eff<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Effect<Q, R>) => Eff<O | Q, R>
}

export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> => ({
    value,
    step: f => eff(step(value, f)),
})
```

No dependency cycle: `eff/module.f.ts` imports from `../module.f.ts`, and the
core module imports nothing back. Everything `eff` needs (`step`, `Effect`,
`Operation`) is already public.

- **Delete** the `Eff` type and `eff` const (and their JSDoc) from
  `fjs/effects/module.f.ts`. The core module doc's mention of `eff` as the
  optional wrapper stays — it now points at the sibling module.
- **Migrate the 23 import sites.** Each currently pulls `eff` from an
  `effects/module.f.ts` path (`../effects/module.f.ts`,
  `../../effects/module.f.ts`, `../module.f.ts`, …); repoint just the `eff` /
  `type Eff` names to the new `…/effects/eff/module.f.ts` path, leaving the
  other names (`pure`, `type Effect`, …) importing from core. This is the same
  mechanical, import-only migration as the `eff` rollout, verifiable by `tsc`.
- **Proof.** Add `fjs/effects/eff/proof.f.ts` with the `eff` cases (currently in
  `fjs/effects/proof.f.ts`): `.value` unwrap, `.step(f).step(g).value`
  chaining, and equivalence with external `step` over a `Do` node. The `step`
  cases stay in the core proof.

### Design decisions

- **Clean move, not a re-export.** The repo convention is explicit per-module
  imports, not barrel re-exports, so do *not* keep a compatibility
  `export { eff } from './eff/module.f.ts'` in the core module — update the call
  sites instead. This keeps one home per symbol.
- **The counter-precedent is acknowledged.** `fjs/types/function/module.f.ts`
  keeps `compose` (the primitive) and `fn` (the fluent chainer) in the *same*
  module — the very precedent `eff` was modeled on. This proposal deliberately
  diverges for effects because the core effects module carries far more than a
  two-line primitive (the model, `decode`/`match`, constructors, combinators),
  so the primitive-vs-sugar split earns its own file here where it would be
  overkill for `function`. If the split proves worthwhile, giving `fn` the same
  treatment in `fjs/types/function` is a reasonable follow-up — out of scope
  here.
- **`step` stays in core.** Only the fluent wrapper moves; the `step` primitive
  remains the foundation in `fjs/effects/module.f.ts`, used internally there and
  exercised directly by the core proof.

### Tasks

- [ ] Create `fjs/effects/eff/module.f.ts` with `Eff` + `eff`, importing `step`
      / `Effect` / `Operation` from `../module.f.ts`.
- [ ] Remove `Eff` / `eff` from `fjs/effects/module.f.ts`; keep the doc pointer
      to the new module.
- [ ] Repoint the `eff` / `type Eff` imports at the 23 call-site files to
      `…/effects/eff/module.f.ts` (import-only; `tsc` verifies).
- [ ] Move the `eff` proof cases into `fjs/effects/eff/proof.f.ts`; leave the
      `step` cases in `fjs/effects/proof.f.ts`.

### Related

- `fjs/effects/module.f.ts` — current home of `step` (primitive), `eff`
  (wrapper to move), `decode` / `match`, and the core combinators.
- `fjs/types/function/module.f.ts` — `compose` / `fn` precedent that keeps the
  primitive and its fluent chainer together (the counter-precedent above).
- `fjs/effects/list`, `fjs/effects/memory`, `fjs/effects/mock`,
  `fjs/effects/node` — existing sibling submodules the new `eff` module joins.
