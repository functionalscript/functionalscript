/**
 * Mock effect runtimes for testing effectful programs.
 *
 * @module
 */
import { match, type Effect, type Operation, type Pr } from "../module.f.ts"

/**
 * A synchronous, state-threading operation map. An entry takes the command's
 * payload (fixed when the command is issued) and returns a state transition —
 * the curried `state` parameter is data the runner supplies on each step.
 */
export type MemOperationMap<O extends Operation, S> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => (state: S) => readonly[S, Pr<O, K>[1]]
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
    const next = match(o)
    let s = state
    let e = effect
    while (true) {
        const r = next(e)
        if (r[0] === 'done') {
            return [s, r[1]]
        }
        const [ns, m] = r[1](s)
        s = ns
        e = r[2](m)
    }
}
