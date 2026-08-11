/**
 * Types for mock effect runtimes.
 *
 * @module
 */

import type { Effect, Operation, Pr } from "../types.ts"

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
