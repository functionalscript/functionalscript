## simplify-list-type. Drop `Concat` from the `List` type

**Priority:** P4
**Status:** open

### Problem

`List` (`fjs/types/list/types.ts`) currently has four shapes behind two
type aliases:

```ts
export type List<T> = NotLazy<T> | Thunk<T>

type NotLazy<T> = Result<T> | Concat<T> | readonly T[]

type Concat<T> = {
    readonly head: List<T>
    readonly tail: List<T>
}
```

`Concat` is a second, structurally different non-empty node: every consumer
that walks a list has to discriminate `'head' in x` from `'first' in x`
before it can make progress — see `next` (`:62-82`) and `lengthList`
(`:279-289`), both of which carry a dedicated `Concat` branch. `NotLazy`
exists only to name the union that `Concat` forces.

The cost is paid by every future walker, and `Concat` buys one thing:
`concat` is O(1) and defers the traversal, so repeated left-nested
concatenation does not become quadratic.

### Proposal

Reduce `List` to three shapes:

```ts
export type List<T> = readonly T[] | Thunk<T>
export type Thunk<T> = () => ThunkResult<T>
export type ThunkResult<T> = readonly T[] | Empty | NonEmpty<T>
export type Empty = null
export type NonEmpty<T> = {
    readonly first: T
    readonly tail: List<T>
}
```

`Concat` and `NotLazy` go away. `concat(head)(tail)` becomes a thunk that
walks `head` and appends `tail` lazily, keeping the O(1)-per-step,
non-quadratic behaviour that the `Concat` node provides today — this is the
part of the change to verify rather than assume.

Two things to settle before the rewrite:

- **`Empty` at the top level.** The proposed `List` no longer admits `null`
  directly, only as a `ThunkResult`. Check every call site that passes
  `null` as a list; either keep `Empty` in `List` or migrate those to `[]`.
- **Performance.** `concat`-heavy paths (`next`, `lengthList`, `flat`,
  `flatMap`) need a before/after comparison on a deeply left-nested
  concatenation, to confirm the thunk form does not reintroduce the
  quadratic behaviour `Concat` avoids.

`fjs/types/list` is imported by ~40 modules, so this is a wide but
mechanical change; the type-level part is caught by `npx tsc`.

### Tasks

- [ ] Decide whether `Empty` stays in `List` or call sites migrate to `[]`.
- [ ] Reimplement `concat` as a thunk; delete `Concat` and `NotLazy`.
- [ ] Collapse the `'head' in …` branches in `next` and `lengthList`.
- [ ] Benchmark left-nested `concat` before and after.
- [ ] Update consumers; `npx tsc`, `fjs t`.

### Related

- [GitHub issue #256](https://github.com/functionalscript/functionalscript/issues/256)
  — the original report.
- `fjs/types/list/module.f.mjs:22-47` — the current type; `:54`, `:62`,
  `:279` — the `Concat` branches.
