/**
 * Mock effect runtimes for testing effectful programs.
 *
 * @module
 */
import type { Effect, Operation, Pr } from "../module.f.ts"

export type MemOperationMap<O extends Operation, S> = {
    readonly [K in O[0]]: (state: S, payload: Pr<O, K>[0]) => readonly[S, Pr<O, K>[1]]
}

export type RunInstance<O extends Operation, S> =
    (state: S) =>
    <O1 extends O, T>(effect: Effect<O1, T>) =>
    readonly[S, T]

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
        const [ns, m] = operation(s, payload)
        s = ns
        e = cont(m)
    }
}
