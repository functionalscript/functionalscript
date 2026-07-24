import { step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect}. `.step(f)` is
 * bind — `f` returns another `Eff`, so `.step(f).step(g)` chains and a chain
 * stays in the `Eff` world throughout — and `.value` is the exit back to a raw
 * `Effect`. An `Eff` is not assignable to `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Effect<Q, R>) => Eff<O | Q, R>
}

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> => ({
    value,
    step: f => eff(step(value, f)),
})
