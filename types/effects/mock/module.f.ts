/**
 * Mock effect runtimes for testing effectful programs.
 *
 * @module
 */
import type { Effect, Operations } from "../module.f.ts"

export type MemOperationMap<O extends Operations, S> = {
    readonly [K in keyof O]: (state: S, payload: O[K][0]) => readonly[S, O[K][1]]
}

export type RunInstance<O extends Operations, S> =
    (state: S) => <O1 extends O, T>(effect: Effect<O1, T>) => readonly[S, T]

export const run =
    <O extends Operations, S>(o: MemOperationMap<O, S>): RunInstance<O, S> =>
    state =>
    effect =>
{
    let s = state
    let e = effect
    while (true) {
        if (e.length === 1) {
            return [s, e[0]]
        }
        const [cmd, payload, cont] = e
        const operation = o[cmd]
        const [ns, m] = operation(s, payload)
        s = ns
        e = cont(m)
    }
}
