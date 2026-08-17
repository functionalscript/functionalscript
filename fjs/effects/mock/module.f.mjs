/**
 * Mock effect runtimes for testing effectful programs.
 *
 * See `./types.ts` for the `MemOperationMap`/`RunInstance` type-level API.
 *
 * @module
 *
 * @import { Commands, MatchResult, Operation, RawEffect } from '../types.ts'
 * @import { MemOperationMap, PartialMemOperationMap, RunInstance } from './types.ts'
 */

import { match, partialMatch } from "../module.f.mjs"
import { notImplemented } from "../io/module.f.mjs"
import { error } from "../../types/result/module.f.mjs"

/** @type {<O extends Operation, S>(o: MemOperationMap<O, S>) => RunInstance<O, S>} */
export const run = o => _loop(match(o))

/**
 * {@link run} for a runner that implements only part of `O`.
 *
 * A command in `commands` with no handler answers `error(notImplemented)`
 * through the ordinary continuation, so a program that asks for something this
 * runner lacks gets its control back and decides what to do. A command outside
 * `commands` still panics — see `partialMatch`.
 *
 * **The injector lives here rather than at the call site.** `partialMatch`
 * cannot build one because the shape of an answer is the runner's, not the
 * operation's; this loop's is `(state) => [state, …]`, and writing it once here
 * is the whole reason each runner supplies its own.
 *
 * @type {<O extends Operation, S>(commands: Commands<O>) => (o: PartialMemOperationMap<O, S>) => RunInstance<O, S>}
 */
export const partialRun = commands => o => {
    /** @type {(command: string) => (state: any) => readonly[any, any]} */
    const onMissing = command => state => [state, error(notImplemented(command))]
    return _loop(partialMatch(commands, onMissing)(o))
}

/**
 * The interpreter loop both runners share: step the effect, thread the state
 * through the handler's transition, resume with the command's output.
 *
 * @type {<O extends Operation, S>(
 *     next: <O1 extends O, T>(e: RawEffect<O1, T>) => MatchResult<O1, T, (state: S) => readonly[S, any]>
 * ) => RunInstance<O, S>}
 */
const _loop = next => state => effect => {
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
