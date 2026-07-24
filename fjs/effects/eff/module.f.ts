/**
 * Fluent method-chaining wrapper for raw effects.
 *
 * @module
 */

import { step, pure as pureEffect, type Effect, type Operation } from '../module.f.ts'

/**
 * A fluent, method-chaining monad over a raw {@link Effect}. `.step(f)` is bind:
 * `f` returns another `Eff`, so `.step(f).step(g)` chains and a chain stays in
 * the `Eff` world throughout. `.value` is the exit back to a raw `Effect`.
 * An `Eff` is not assignable to `Effect`; unwrap with `.value`.
 */
export type Eff<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Eff<Q, R>) => Eff<O | Q, R>
}

type EffCompat<O extends Operation, T> = {
    readonly value: Effect<O, T>
    readonly step: <Q extends Operation, R>(f: (t: T) => Eff<Q, R> | Effect<Q, R>) => EffCompat<O | Q, R>
}

const unwrap = <O extends Operation, T>(result: Eff<O, T> | Effect<O, T>): Effect<O, T> =>
    typeof result === 'object' && 'value' in result ? result.value : result

/** Wraps a raw {@link Effect}; the bridge into the `Eff` world. */
export const eff = <O extends Operation, T>(value: Effect<O, T>): EffCompat<O, T> => ({
    value,
    step: f => eff(step(value, t => unwrap(f(t)))),
})

/** The monad unit: a pure value as an `Eff`. */
export const pure = <T>(v: T): Eff<never, T> => ({
    value: pureEffect(v),
    step: f => eff(step(pureEffect(v), t => f(t).value)),
})
