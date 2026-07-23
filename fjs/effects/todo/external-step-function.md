## Make the raw value the effect, and move `step` out of it

**Priority:** P2
**Status:** open

### Problem

Every `Effect` today is a `{ value, step }` wrapper. The `value` **is** the raw
effect — a `Pure` thunk or a `Do` node — and `step` is a method whose
implementation dispatches on whether the effect is pure or impure:

- `pure` / `lazy` — `step: f => f(t())` (`fjs/effects/module.f.ts`)
- `doFull` — `step` rebuilds a `Do` node wrapping the continuation
- `decode` — the `typeof value === 'function'` shape check

That is the pure/impure dispatch encoded in **three** places. The doc comment
on `decode` claims it is "the only function that knows how `Value` is laid
out" — the constructors' `step` closures already contradict it.

The method also bakes one blessed composition API into every node, and forces a
per-node wrapper object to exist. Two goals:

1. Make the **raw value** the primary effect type, with `decode` as the single
   shape inspector and composition provided externally — like
   `fjs/types/function`, where `compose` is the primitive and `fn` is optional
   sugar.
2. Drop the per-node `{ value, step }` wrapper as the type that flows around.

### The variance constraint (why the naive collapse fails)

The obvious move — "delete `step` and let `Effect<O, T>` just be the raw
`Value<O, T>` union" — does **not** type-check, and this is the crux of the
whole task.

`Do<O, T>`'s continuation input is `Pr<O, O[0]>[1]` — the union of *all* the
commands' output types. That is a **contravariant** position, so a bare
`Value<O, T>` union is *not covariant in `O`*: `Value<Write>` is **not**
assignable to `Value<Write | Read>`. But the effect system relies on exactly
that widening everywhere — `all`, `both`, `step`'s `O | Q`, and every handler
that returns a narrow effect into a wider `NodeOp` slot.

The reason it works **today** is that `{ value, step }` is a recursive generic
**object** alias; TypeScript measures such an alias's variance leniently and
short-circuits the structural check (which here happens to give the *correct*,
sound answer). A raw union/tuple is compared structurally instead and fails.
Collapsing to a bare `Value` breaks ~150 widening sites — verified, not a
hunch.

### Solution: annotate the continuation `out O`

Make the raw value itself covariant in `O`, so it can be the primary type
without any wrapper — **while keeping `Do` a positional tuple**.

TypeScript only accepts variance annotations (`in` / `out`, TS 4.7+) on
**object, function, constructor, and mapped-type** aliases — never on a tuple
or union alias (`TS2637`). So you cannot write `type Do<out O, T> = readonly[…]`
directly. But the contravariance lives entirely in the continuation, which
*is* a function type — extract it into its own alias and annotate that:

```ts
export type Cont<out O extends Operation, T> = (_: Pr<O, O[0]>[1]) => Effect<O, T>
export type Do<O extends Operation, T> = readonly[O[0], Pr<O, O[0]>[0], Cont<O, T>]

// The raw value is now the effect. `Pure` has no `O`; `Do` inherits covariance
// from `Cont`; so the union is covariant in `O`.
export type Effect<O extends Operation, T> = Pure<T> | Do<O, T>
export type Pure<T> = () => T
```

`Cont<out O, …>` asserts the covariance TypeScript cannot derive through the
conditional `Pr` type. **It is sound:** the `command` tag pins exactly which
command's output the continuation receives, and every interpreter dispatches on
the tag first, so a `write` node's continuation is only ever called with
`void` — the op-set can grow without ever mishanding a continuation. `out`
enables only the widening direction (`Effect<A>` <: `Effect<A | B>`); it does
**not** enable the unsound narrowing.

Verified **cast-free** end-to-end against the real shapes: concrete widening,
generic widening (`Effect<Q>` → `Effect<O | Q>`, which `step`/`both` need
internally), `decode` (positional `v[0]/v[1]/v[2]`), `doFull` (returns
`[cmd, param, cont]`), external `step`, `all`, and `both` all type-check. The
`Do` tuple keeps its positional shape, so `decode`/`match`/runners are
unchanged in how they read a node. The one caveat is ordinary inference
(`all(w, r)` unifies `O` to the first argument); call sites that already pass
explicit type arguments (`both` does) are unaffected.

### Design

- **`Effect<O, T>` = the raw value** (today's `Value`). Returned directly by
  `pure`, `lazy`, `doFull`, `do_`, and every operation (`mkdir`, `readFile`, …).
  `decode` / `match` / runners consume it. It is plain data with no methods.
- **`Eff<O, T>` = the `fn`-style wrapper**, `{ value: Effect<O, T>, step, … }`,
  built by `eff(value)`, for optional method-chaining. Mirrors `fn` over
  `compose`.
- **External `step(e, f)`** — the data-first primitive, a thin wrapper over
  `decode` (see below). `Eff.step` and any curried flavor are thin wrappers
  over it.

```ts
export const step = <O extends Operation, T, Q extends Operation, R>(
    e: Effect<O, T>,
    f: (t: T) => Effect<Q, R>
): Effect<O | Q, R> => {
    const d = decode(e)
    return d.done
        ? f(d.result)
        : doFull<O | Q, R, O[0]>(d.command, d.payload, x => step(d.continuation(x), f))
}
```

At call sites:

```ts
// before
mkdir(...).step(f)
// after — raw effect, wrap only when you want the chainer
eff(mkdir(...)).step(f)   // fn-style
step(mkdir(...), f)       // external primitive
```

### Design decisions

- **`Cont<out O, T>` is a documented invariant, not a hack.** JSDoc on `Cont`
  must state the tag-dispatch soundness argument so the annotation is never
  stripped. Anyone changing the continuation representation must re-check it.
- **`Do` stays a positional tuple.** The `out` annotation goes on `Cont`, so
  `decode` / `match` / the virtual/mock runners keep reading `[0]` / `[1]` /
  `[2]` — no switch to named fields, no cast.
- **Exactly one function inspects the shape: `decode`.** `step` wraps it; no
  second `typeof value === 'function'` check may appear anywhere. State this in
  the module doc, replacing the current "must not be extended with new methods"
  framing.
- **Data-first `step(e, f)`** lets TypeScript contextually type the lambda from
  the effect — the common case. A curried data-last `step(f)(b)` can ship
  alongside only if a point-free site needs it (`foldStep`, `okStep`).
- **The step-adapter convention survives.** `okStep` etc. stay adapters, passed
  as `step(e, okStep(f))` / `eff(e).step(okStep(f))`.

### Tasks

- [ ] Extract the continuation into `Cont<out O, T>` and rebuild `Do` as
      `readonly[O[0], Pr<O, O[0]>[0], Cont<O, T>]`. Rename the raw `Value` →
      `Effect`; the old `{ value, step }` wrapper type goes away as the flowing
      type. Document the `out O` soundness invariant in JSDoc on `Cont`.
- [ ] Add the `Eff<O, T>` wrapper + `eff()` and the external data-first
      `step(e, f)` (a thin wrapper over `decode`).
- [ ] State the "exactly one function inspects the shape" rule in the module
      doc, replacing the "must not be extended with new methods" framing.
- [ ] Migrate the `.step(` call sites — ~161 across 25 files, including
      `List<O, T>` stream code (`fjs/effects/list`, `fjs/cas`) and the core's
      own `foldStep` / `forEachStep` — to `eff(x).step(f)` (or external
      `step(x, f)`).

### Related

- `fjs/types/function/module.f.ts` — `compose` / `fn` precedent for
  "primitive + optional chainer".
- `fjs/effects/list/module.f.ts` — `List<O, T>` is `Effect<O, Next<O, T>>`, so
  its call sites migrate the same way.
- `decode` / `match` — already the interpreter-facing half of this contract.
- TypeScript variance annotations (`in` / `out`, TS 4.7+) — legal only on
  object / function / mapped-type aliases (`TS2637`), which is why the `out`
  goes on the `Cont` function alias rather than the `Do` tuple.
