## effect-list-fold. Move `foldStep` / `forEachStep` into `fjs/effects/list` and fold streams

**Priority:** P3
**Status:** open. Unaffected in substance by the fallible-cell change — this is
about folding a *stream* rather than a materialized list, which is still true —
but any `List<O, IoResult<Vec>>` spelling below is now
`List<O, Vec, IoChannel>`, and the error-item case the sketches carry is gone.

### Problem

`foldStep` and `forEachStep` take `Effect<O, List<T>>` over `fjs/types/list`'s
strict `List<T>` — an effect that yields a **fully materialized** list. Every
element exists in memory before the first `f` runs, and the fold cannot begin
until the last element has been produced.

That is not the shape the codebase's real sequences have.
`fjs/effects/list/module.f.mjs` already defines the streaming one:

```ts
export type List<O extends Operation, T> = Effect<O, Next<O, T>>
```

one effect per cons cell, where the tail is not reached until a runner performs
the command that produces it. So there are two list vocabularies, and the fold
combinators speak the wrong one. Three consequences:

**Producers materialize to satisfy the signature.** `cas.list()` is
`Effect<O, readonly Vec[]>` built from a `recursive: true` readdir — every hash
in the store lives in memory at once, purely because `foldStep` cannot consume
anything else.

**The layering is inverted.** `fjs/effects/module.f.mjs` — the core effect module
— imports `fjs/types/list` for `fold` and `List`, and *nothing else in
that file uses either*. The two fold combinators are the module's only dependency
on the strict list type.

**The stream fold is being hand-written separately.** See
[fold-stream-combinator](./fold-stream-combinator.md): the *EOF → finalize;
error item → propagate; chunk → fold and recurse* skeleton appears in four
places. That is `foldStep` over a stream, plus a short-circuit.

### Proposal

**1. Rename `List<O, T>` → `EffectList<O, T>`** in
`fjs/effects/list/module.f.mjs`. It collides with `fjs/types/list`'s `List<T>`,
and the eight importers currently alias around the clash — `elEmpty` in
`fjs/cas`, `fjs/cas/evo`, `fjs/mcp`; `emptyList` in `fjs/media/type/proof`.
The rename has value independent of the rest of this issue.

**2. Move `foldStep` / `forEachStep`** out of `fjs/effects/module.f.mjs` and into
`fjs/effects/list/module.f.mjs`, retyped over `EffectList`:

```ts
export const foldStep = <O extends Operation, T, Q extends Operation, S>(
    items: EffectList<O, T>,
    init: S,
    f: (item: T) => (state: S) => Effect<Q, S>
): Effect<O | Q, S> =>
    step(
        items,
        next => next === undefined
            ? pure(init)
            : step(f(next.first)(init), s => foldStep(next.tail, s, f)))
```

Keep the step-variant shape — effect first, one argument per line when the call
wraps. That is not a style preference: a step variant is this module's `do`
notation, so the argument list is a statement list in execution order and the
effect comes first because it happens first. The rationale currently lives on
`foldStep`'s JSDoc and in the `fjs/effects/module.f.mjs` header; carry both over.

**3. Add a strict-list converter.** All six current call sites hold a strict
list, so the move needs a way in:

```ts
export const fromList = <O extends Operation, T>(items: List<T>): EffectList<O, T> =>
```

built from `empty` / `nonEmpty`. The four `pure(...)` call sites below become
`fromList(...)`.

**Layering.** `fjs/effects/list/module.f.mjs` already imports `pure` from
`../module.f.mjs` and `Effect`/`Operation` from `../types.ts`; adding `step` is
the same direction, so no cycle. After the move, `fjs/effects/module.f.mjs` drops its
`fjs/types/list` import entirely and the core effect module no longer depends on
the strict list type at all.

### Call sites

Six, all currently strict:

| site | argument | after |
| --- | --- | --- |
| `fjs/cas/cli/module.f.mjs:63` | `c.list()` | streams once `cas.list()` does |
| `fjs/cas/evo/module.f.mjs:202` | `cas.list()` | streams once `cas.list()` does |
| `fjs/cas/evo/module.f.mjs:280` | `pure(parents)` | `fromList(parents)` |
| `fjs/cas/module.f.mjs:149` | `pure(expired)` | `fromList(expired)` |
| `fjs/cas/module.f.mjs:310` | `pure([0…7])` | `fromList([0…7])` |
| `fjs/djs/transpiler/module.f.mjs:73` | `pure(pathsArray)` | `fromList(pathsArray)` |

The two `cas.list()` sites are the ones this exists for; converting them is a
follow-up in `fjs/cas` (see *Related*), not part of this issue.

### What it unblocks

- **`foldStream` mostly dissolves.**
  [fold-stream-combinator](./fold-stream-combinator.md) becomes an ordinary
  `foldStep`, rather than a fourth hand-written skeleton. The short-circuit it
  described is no longer part of the shape at all: a `List` cell carries its own
  failure now, so the Io `step` propagates it. Re-scope or close that issue.
- **`cas.list()` can stream.** `Effect<O, readonly Vec[]>` → `EffectList<O, Vec>`,
  so a large store's hash list never materializes. This is where the memory win
  actually is — `foldStep` taking a stream buys nothing until the producer
  yields one.

### Open questions

- **Stack depth.** The recursion composes one `step` per element, and `step` is
  eager on a `Pure` head, so a fully pure stream (anything from `fromList`)
  folds at composition time and recurses O(n) deep. The current `fold`-based
  implementation has the same property, so this is not a regression — but
  confirm it with a large-`n` proof before relying on it. If it bites, the
  answer is for producers to yield `Do` nodes, not to change the combinator.
- **`S` inference.** `init` sitting before `f` already forces one annotation, at
  `fjs/cas/evo/module.f.mjs:282` (`acc: Result<readonly Revision[], string>`);
  without it TypeScript fixes `S` to `Ok<…>` from `init` and the `'error'`
  branch goes dead. The retype should not change this, but re-check.
- **Proof coverage.** `fjs/effects/list/` has no `proof.f.mjs` at all today.
  AGENTS.md requires 100% proof coverage across every dimension, so the move
  needs one created — covering `empty` and `nonEmpty` as well as the moved
  combinators and `fromList`.
- **Does `forEachStep` still earn its place** once `foldStep` is one line away?
  It is `foldStep(items, undefined, item => () => f(item))`. Keep it — the
  `void` accumulator is the common case — but confirm against call sites after
  the move.

### Tasks

- [ ] Rename `List<O, T>` → `EffectList<O, T>` in `fjs/effects/list/module.f.mjs`;
      update the eight importers and drop the `elEmpty` / `emptyList` aliases
      that existed only to dodge the name clash.
- [ ] Add `fromList` to `fjs/effects/list/module.f.mjs`.
- [ ] Move `foldStep` / `forEachStep` there, retyped over `EffectList`, carrying
      their JSDoc and the step-variant rationale.
- [ ] Remove the now-unused `fjs/types/list` import from
      `fjs/effects/module.f.mjs`.
- [ ] Migrate the six call sites; the four strict ones go through `fromList`.
- [ ] Create `fjs/effects/list/proof.f.mjs` with full coverage.
- [ ] Re-scope or close [fold-stream-combinator](./fold-stream-combinator.md).
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [fold-stream-combinator](./fold-stream-combinator.md) — the stream fold this
  subsumes; blocked-on/blocks relationship should be settled when this is
  reviewed.
- [allreduce-combinator](./allreduce-combinator.md) — the parallel sibling;
  it is specified over `List<T>` and will want the same treatment.
- [write-closed-helpers](../../cas/todo/write-closed-helpers.md) — already
  blocked by `fold-stream-combinator`, so transitively affected.
- `fjs/effects/module.f.mjs` header — the step-variant / `do`-notation rationale
  that fixes the argument order.
