# 65Z-effect-runner-stepper. `effects`: share the runner loop between `asyncRun` and the mock `run`

**Priority:** P4
**Status:** open

## Problem

Two effect runners independently implement the same `while (true)` driver
loop:

```ts
// fs/types/effects/module.ts:3
export const asyncRun =
    <O extends Operation>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<O, T>>(effect: Effect<O, T>): Promise<T> =>
{
    while (true) {
        const { value } = effect
        if (value.length === 1) {
            return value[0]
        }
        const [command, payload, continuation] = value
        const operation = map[command]
        const result = await operation(...payload)
        effect = continuation(result)
    }
}

// fs/types/effects/mock/module.f.ts:17
export const run =
    <O extends Operation, S>(o: MemOperationMap<O, S>): RunInstance<O, S> =>
    state =>
    effect =>
{
    let s = state
    let e = effect
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
}
```

The trampoline is identical:

1. Peel `value` off the current effect.
2. If `value.length === 1` — pure case — return it.
3. Otherwise destructure `[cmd, payload, cont]`, look up the op, run it,
   then continue with `cont(result)`.

The two runners differ only along two orthogonal axes:

- **Effect of running a single op.** `asyncRun` does `await op(...payload)`;
  the mock does `op(state, ...payload)` and threads `state` through.
- **Shape of the final result.** `asyncRun` returns `Promise<T>`; the mock
  returns `[State, T]`.

Both differences live entirely inside "what does it mean to step one operation
and produce the next state?" — the trampoline that drives the loop is shared
verbatim.

## Proposal

The sync/async divide is real — a synchronous `drive` cannot `await op(...)`,
so a single function cannot host both runners' loops as-is. Two honest paths
forward, in order of how much code they actually share:

### Option A — share only the pure-tuple classifier

Extract the smallest piece both runners must agree on — "what does the
`value` tuple look like in the pure case vs. the dispatch case?" — and let
each runner keep its own loop:

```ts
// fs/types/effects/module.ts (sketch)

/** The shape of `Effect.value`: either pure `[T]` or `[cmd, payload, cont]`. */
export type Step<O extends Operation, T> =
    | readonly [T]
    | readonly [O[0], Pr<O, O[0]>[0], (i: unknown) => Effect<O, T>]

/** Pull the next step out of an Effect. Pure data; no I/O. */
export const step = <O extends Operation, T>(e: Effect<O, T>): Step<O, T> =>
    e.value
```

Both `asyncRun` and the mock `run` then read `step(e)` and switch on
`s.length === 1` — the pure-shape recognition becomes one assertion in one
place, so a future change to the `Value` representation breaks one site
instead of every runner. The trampolines themselves stay open-coded
(`while (true) { … }`) in each runner because their dispatch is
fundamentally different.

This is the cheap, no-regrets piece. It does not deliver the "one driver,
many runners" abstraction — but it makes the contract explicit without
forcing sync code to pretend to be async.

### Option B — share the driver in async form

If the goal is one trampoline, it must be async-only. The `runOp` callback
returns a `Promise<NextStep>`, and the synchronous mock either wraps each
step in `Promise.resolve(...)` (paying a microtask per op for test
fixtures, which is fine) or stays open-coded and only the production async
runners (Node, worker sandbox, replay) share the loop:

```ts
type Next<O extends Operation, T, R> =
    | { done: true,  result: R }
    | { done: false, effect: Effect<O, T> }

export const driveAsync = <O extends Operation, T, R>(
    onPure: (v: T) => R,
    runOp:  (cmd: O[0], payload: readonly unknown[], cont: (i: unknown) => Effect<O, T>)
              => Promise<Next<O, T, R>>,
) => async (e: Effect<O, T>): Promise<R> => {
    while (true) {
        const v = e.value
        if (v.length === 1) { return onPure(v[0]) }
        const n = await runOp(v[0], v[1], v[2])
        if (n.done) { return n.result }
        e = n.effect
    }
}
```

`asyncRun` becomes a one-line specialisation. The mock either opts in
(wrapping its sync ops) or — more honestly — stays as it is and the win
is "share the loop across async runners only".

### Recommendation

Land Option A first regardless — it is a few lines, zero behaviour
change, and pins down the `Value`-tuple contract for everyone. Treat
Option B as a separate question that only becomes urgent when a second
async runner appears (cf. [i206](./206-worker-sandbox.md)). Until then,
the two trampolines are 6 lines each and the duplication is tolerable.

## Why this qualifies

- **DRY at the structural level.** The trampoline is the heart of the effect
  system; both runners must always agree on its semantics (pure-tuple shape,
  destructuring order, continuation contract). Centralising the loop locks
  that contract down rather than relying on two readers to keep them in sync.
- **Removes a footgun for future runners.** A worker-based sandbox runner
  (cf. [i206](./206-worker-sandbox.md)) or a streaming/log-replay runner
  would each need the same loop — if it stays open-coded, they'll be the
  third and fourth copies.
- **Sharpens the boundary.** The current `runOp`-vs-trampoline split is
  implicit. Naming it forces the question "what *is* an effect runner, the
  loop or the op-dispatcher?" — and the answer (op-dispatcher) tightens the
  next runner design.

## Caveats

- **Sync cannot host async.** A synchronous `drive` function cannot
  `await` inside its loop — there is no syntax that lets a sync body
  observe a Promise's resolution. This is the bug that killed the
  original single-driver sketch and is why the proposal above splits
  into Option A (no loop sharing) and Option B (async-only loop). Do
  not try to "wrap the await away"; it is structural.
- The mock's state-threading is genuinely additive — it changes the
  per-step *and* the return type. Any shared loop has to carry an `S`
  parameter through cleanly without forcing the async runner to fake one.
  A two-tier design (a state-aware `drive` and an `asyncRun` that uses it
  with `S = void`) is one option; a single combinator with two callbacks
  (`onPure`, `runOp`) is another.
- TypeScript's variance on the existential `cmd` makes the type plumbing
  here non-trivial. A small spike is warranted before committing to a
  signature.
- The win is small in lines (each runner is ~15 lines today). The real
  value is in pinning down the contract — judge the proposal on that, not
  on LOC.

## Related

- [i206](./206-worker-sandbox.md) — proposed worker-based sandbox runner;
  a third copy of the trampoline waiting to happen if this stays
  open-coded.
- [i65Y-io-type-duplication](./65Y-io-type-duplication.md) — same family:
  the effect-system boundary has two parallel implementations that should
  agree on contract.
