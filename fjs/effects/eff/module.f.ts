import { pure, step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect} that also
 * accumulates the history of every value the chain has produced. `.step(f)`
 * is bind — `f` receives the current value followed by every prior value,
 * most recent first (`f(t, ...p)`), and returns a raw `Effect`; `.step`
 * re-wraps the result together with that history so `.step(f).step(g)`
 * chains and stays in the `Eff` world throughout. `P` is the tuple of prior
 * values available to the *next* `.step` call; it grows by one element (the
 * current `T`) on every step, starting empty at {@link eff}. `.value` is the
 * exit back to a raw `Effect`, discarding the history. An `Eff` is not
 * assignable to `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[] = readonly[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, ...p: P) => Effect<Q, R>) => Eff<O | Q, R, readonly[T, ...P]>
}

/** Builds an `Eff` from a raw `Effect` of a `[current, ...history]` tuple. */
const create = <O extends Operation, T, P extends readonly unknown[]>(
    both: Effect<O, readonly[T, ...P]>): Eff<O, T, P> =>
({
    value: step(both, ([t]) => pure(t)),
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
