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

Extract the trampoline as a `stepper` combinator parameterized over a
"run-one-op" callback that already knows how to obtain the next continuation
input:

```ts
// fs/types/effects/module.ts (sketch)

/** Pull the next operation out of an Effect, or recognise it as pure. */
export type Step<O extends Operation, T> =
    | readonly [pure: T]
    | readonly [cmd: O[0], payload: Pr<O, O[0]>[0], cont: (input: unknown) => Effect<O, T>]

export const step = <O extends Operation, T>(e: Effect<O, T>): Step<O, T> => e.value

/**
 * Drives an Effect to completion. The caller supplies `runOp`, which knows
 * how to execute a single operation (synchronously, asynchronously, against a
 * state, against a mock fixture, …) and returns the next Effect to drive.
 */
export const drive = <O extends Operation, T, R>(
    onPure: (v: T) => R,
    runOp:  (cmd: O[0], payload: readonly unknown[], cont: (i: unknown) => Effect<O, T>) => readonly [Effect<O, T>, R | null],
) => (e: Effect<O, T>): R => {
    while (true) {
        const v = e.value
        if (v.length === 1) { return onPure(v[0]) }
        const [next, maybeResult] = runOp(v[0], v[1], v[2])
        if (maybeResult !== null) { return maybeResult }
        e = next
    }
}
```

The exact signature is up for negotiation — the goal is that `asyncRun` and
the mock `run` shrink to two near-trivial calls into the shared driver,
varying only in how a single op is dispatched and how state is threaded.

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

- The mock's state-threading is genuinely additive — it changes the
  per-step *and* the return type. The abstraction has to carry an `S`
  parameter through cleanly without forcing the async runner to fake one.
  A two-tier design (a state-aware `drive` and an `asyncRun` that uses it
  with `S = void`) is one option; a single combinator with two callbacks
  (`onPure`, `runOp`) is another.
- TypeScript's variance on the existential `cmd` makes the type plumbing
  here non-trivial. A small spike is warranted before committing to a
  signature.
- The `await` keyword sits inside the loop in `asyncRun`. If the shared
  driver is a synchronous function, the async runner needs to wrap each
  iteration in a continuation-returning callback (or the driver becomes
  async-aware itself). Either is fine; pick whichever keeps `asyncRun`
  short.
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
