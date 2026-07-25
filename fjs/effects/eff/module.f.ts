import { pure, step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect} that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `P` is the tuple of prior
 * values available to the *next* `.step` call; it grows by one element (the
 * current `T`) on every step, starting empty at {@link eff}. `.result()` is
 * the exit back to a raw `Effect`, discarding the history. An `Eff` is not
 * assignable to `Effect`; unwrap with `.result()`.
 *
 * `.result()` is a method rather than a property because unwrapping is itself
 * a `step` — it drops the history tuple down to its current value. As a
 * property that step would be built on every `.step` call, including the
 * intermediate links that are never unwrapped; as a method it is paid once,
 * at the boundary where the chain actually exits.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[] = readonly[]> = {
    readonly result: () => Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, ...p: P) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
}

/** Builds an `Eff` from a raw `Effect` of a `[current, ...history]` tuple. */
const create = <O extends Operation, T, P extends readonly unknown[]>(
    both: Effect<O, readonly[T, ...P]>): Eff<O, T, P> =>
({
    result: () => step(both, ([t]) => pure(t)),
    step: f => create(step(
        both,
        tp => step(
            f(...tp),
            r => pure([r, ...tp] as const)
        ),
    )),
})

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world, with an empty history. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> =>
    create(step(value, v => pure([v])))
