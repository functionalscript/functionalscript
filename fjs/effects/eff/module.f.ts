import { empty } from '../../types/array/module.f.ts'
import { step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect}. `.step(f)` is
 * bind — `f` returns a raw `Effect`, and `.step` re-wraps the result so
 * `.step(f).step(g)` chains and stays in the `Eff` world throughout — and
 * `.value` is the exit back to a raw `Effect`. An `Eff` is not assignable to
 * `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T, P extends readonly unknown[] = readonly[]> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Effect<Q, R>) => Eff<O | Q, R>
    readonly prev: P
}

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> => ({
    value,
    step: f => eff(step(value, f)),
    prev: empty,
})
