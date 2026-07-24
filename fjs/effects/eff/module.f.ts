import { pure, step, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect}. `.step(f)` is
 * bind — `f` returns a raw `Effect`, and `.step` re-wraps the result so
 * `.step(f).step(g)` chains and stays in the `Eff` world throughout — and
 * `.value` is the exit back to a raw `Effect`. An `Eff` is not assignable to
 * `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T, P = undefined> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T, p?: P) => Effect<Q, R>) => Eff<O | Q, R, T>
}

const create = <O extends Operation, T, P>(
    both: Effect<O, readonly[T, P]>): Eff<O, T, P> => ({
        value: step(both, ([t]) => pure(t)),
        step: f => create(step(
            both,
            tp => step(
                f(...tp),
                r => pure([r, tp[0]] as const)
            ),
        )),
    })

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): Eff<O, T> =>
    create(step(value, v => pure([v, undefined])))
