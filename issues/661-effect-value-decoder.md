# 661. `effects`: a single decoder for the `Pure | Do` value representation

**Priority:** P3
**Status:** open

The `Effect` ADT encodes a node as a tuple: a **pure** value is a length-1
tuple `readonly[T]`, a **do** node is a length-3 tuple
`readonly[command, payload, continuation]`. The discriminant is the tuple
*length*:

```ts
// fs/types/effects/module.f.ts:17
export type Value<O extends Operation, T> =
    Pure<T> | Do<O, T>

// fs/types/effects/module.f.ts:20
export type Pure<T> =
    readonly[T]

// fs/types/effects/module.f.ts:23
export type DoKPR<O extends Operation, T, K extends string, PR extends readonly[unknown, unknown]> =
    readonly[K, PR[0], (_: PR[1]) => Effect<O, T>]
```

That representation is **private knowledge of the ADT**, but every interpreter
and every test re-derives it by hand. The core module that *defines* the tuple
shape exports **no accessor** for it, so the `value.length === 1` discriminant
and the `[command, payload, continuation]` layout are copy-pasted across the
whole subtree.

## The duplicated decoding

Three hand-rolled interpreter loops, byte-identical except for async/await and
state threading:

```ts
// fs/types/effects/module.ts:7 — async runner
while (true) {
    const {value} = effect
    if (value.length === 1) {
        return value[0]
    }
    const [command, payload, continuation] = value
    const operation = map[command]
    const result = await operation(...payload)
    effect = continuation(result)
}
```

```ts
// fs/types/effects/mock/module.f.ts:24 — sync, state-threaded runner
while (true) {
    const { value } = e
    if (value.length === 1) {
        const [v] = value
        return [s, v]
    }
    const [cmd, payload, cont] = value
    const operation = o[cmd]
    const [ns, m] = operation(s, ...payload)
    s = ns
    e = cont(m)
}
```

```ts
// fs/types/effects/node/proof.f.ts:13 — a third runner, inline in a proof
while (true) {
    const { value } = e
    if (value.length === 1) {
        const [result] = value
        if (result !== 0x2An) { throw result }
        return
    }
    const [cmd, p, cont] = value
    if (cmd !== 'readFile') { throw cmd }
    if (p[0] !== 'hello') { throw p }
    e = cont(['ok', vec8(0x15n)])
}
```

Plus **five** assertion sites that reach into the same representation just to
pull the pure result out of an effect that should already be done:

```ts
// fs/types/effects/proof.f.ts:10 (and :19, :28, :36, :42)
const { value } = e
if (value.length !== 1) { throw value }
if (value[0] !== 10) { throw value[0] }
```

So the `length === 1` discriminant and the tuple index layout appear in **8+
places**, none of which is the module that owns the type.

## Why this is a problem

- **Encapsulation leak.** `Pure<T> = readonly[T]` and the 3-tuple `Do` layout
  are an implementation choice. Today, changing it — e.g. to a tagged
  `{ pure: T } | { command, payload, continuation }` for readability, or adding
  a third node kind — means editing every loop and every proof. The
  representation has no single owner.
- **DRY.** The same decode is written for the async runner, the mock runner,
  and a per-proof runner. That is three real consumers of one algorithm, well
  past the second-consumer bar in `AGENTS.md`.
- **Separation of concerns.** Knowing how an effect node is laid out is the
  job of `effects/module.f.ts`. An interpreter's job is *what to do* with a
  pure value vs. a command — not *how to tell them apart*.

## Proposed: `decode` + `match`

Add one accessor to the core module that turns the positional tuple into a
named, discriminated form. It is the only place that knows the layout:

```ts
// fs/types/effects/module.f.ts
export type Decoded<O extends Operation, T> =
    | { readonly done: true, readonly result: T }
    | {
        readonly done: false,
        readonly command: O[0],
        readonly payload: Do<O, T>[1],
        readonly continuation: Do<O, T>[2],
    }

/** Decodes an effect's next step: a pure result, or a command to perform. */
export const decode = <O extends Operation, T>({ value }: Effect<O, T>): Decoded<O, T> =>
    value.length === 1
        ? { done: true, result: value[0] }
        : { done: false, command: value[0], payload: value[1], continuation: value[2] }
```

`decode` alone removes the discriminant duplication, but each runner would still
re-do the `map[command](...payload)` dispatch. Per @sergey-shandar's review, we
can share that too with a `match` combinator that decodes *and* dispatches,
returning the operation's output while deferring the one world-specific step —
`await` (async) or state-threading (sync) — to the caller:

```ts
// fs/types/effects/module.f.ts

// An operation map whose entries take a command's payload and return some
// output R. Generalizes both `ToAsyncOperationMap` (R = Promise<…>) and the
// curried `MemOperationMap` (R = (state) => [state, …]).
export type OperationMap<O extends Operation, R> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => R
}

export type MatchResult<O extends Operation, T, R> =
    | readonly['done', T]
    | readonly['cont', R, Do<O, T>[2]]

export const match =
    <O extends Operation, R>(map: OperationMap<O, R>) =>
    <T>(effect: Effect<O, T>): MatchResult<O, T, R> => {
        const d = decode(effect)
        return d.done
            ? ['done', d.result]
            : ['cont', map[d.command](...d.payload), d.continuation]
    }
```

What unifies async and sync is the *shape* `R` of the operation's output: if both
operation maps return a value the loop finishes with a single world-specific
eliminator, the two loops become the same skeleton plus one line.

```ts
// async runner — map: (...payload) => Promise<result>, so R = Promise<...>
const ma = match(map)
while (true) {
    const r = ma(effect)
    if (r[0] === 'done') { return r[1] }
    effect = r[2](await r[1])          // eliminator: await
}
```

```ts
// mock runner — map: (...payload) => (state) => [state, result], so R = (s) => [s, ...]
const ma = match(o)
while (true) {
    const r = ma(e)
    if (r[0] === 'done') { return [s, r[1]] }
    const [ns, m] = r[1](s)            // eliminator: thread state
    s = ns
    e = r[2](m)
}
```

This requires currying the mock operation map's state parameter — moving `state`
from the front of the argument list to a trailing curried position:

```ts
// fs/types/effects/mock/module.f.ts
export type MemOperationMap<O extends Operation, S> = {
    // was: (state: S, ...payload: Pr<O, K>[0]) => readonly[S, Pr<O, K>[1]]
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => (state: S) => readonly[S, Pr<O, K>[1]]
}
```

That re-ordering is a worthwhile separation in its own right: an operation's
*arguments* (fixed when the command is issued) are now distinct from the *state*
it threads (data the runner supplies) — the same currying discipline
[i164-uncurry-accumulators](./164-uncurry-accumulators.md) discusses.

The proofs need no dispatch, so they use `decode` directly:

```ts
// effects/proof.f.ts
const d = decode(e)
if (!d.done) { throw e.value }
if (d.result !== 10) { throw d.result }
```

## Why this is feasible (typing)

Both production runners *already* write `const [command, payload, continuation] =
value` and then call `operation(...payload)`; that compiles today against the
decorrelated union types of `Do<O, T>`. `decode` returns those same three bindings
under names, and `match` invokes the operation exactly as the runners do now — so
the type situation is unchanged. No `as` casts are introduced; the length check
narrows the tuple union structurally (no type predicate needed), in line with
`AGENTS.md`.

## Scope / caveats

- Pure win: the five `proof.f.ts` assertions and the `node/proof.f.ts` runner
  are the unambiguous DRY reductions.
- The two production runners (`module.ts`, `mock/module.f.ts`) live in
  different files (`.ts` side-effecting vs. `.f.ts` pure-runner), but both can
  import `decode`/`match` from the `.f.ts` core — no layering violation.
- The `MemOperationMap` currying is a breaking change to every sync operation
  map. The known consumer is the virtual filesystem
  (`fs/types/effects/node/virtual/module.f.ts`), whose `operation`/`readOperation`
  helpers build `(state, path) => …` operations; they must move to
  `(...payload) => (state) => …`. That migration is mechanical but touches every
  op, so it should be audited before committing — or `match` can be introduced
  with `decode` first and the currying landed as a follow-up.
- No behaviour change, so the existing effect proofs are the regression test.

## Related

- [i164-uncurry-accumulators](./164-uncurry-accumulators.md) — same spirit of
  giving the effect/state machinery a single, well-shaped representation.
- [i208-try-catch-consolidate](./208-try-catch-consolidate.md) — lifting an
  open-coded helper (`tryCatch`) into the module that should own it.
