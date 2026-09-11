/**
 * Impure effect interpretation: runs an `Effect` step by step against an
 * asynchronous operation map.
 *
 * @module
 *
 * @import { Commands, Effect, Operation, PartialOperationMap, ToAsyncOperationMap } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { match, notImplemented, partialMatch } from './module.f.mjs'
import { error } from '../types/result/module.f.mjs'

/**
 * @template {Operation} O
 * @param {ToAsyncOperationMap<O>} map
 * @returns {<T, E>(effect: Effect<O, T, E>) => Promise<Result<T, E>>}
 */
export const asyncRun = map => async effect => {
    const next = match(map)
    while (true) {
        const r = next(effect)
        if (r[0] === 'done') {
            return r[1]
        }
        effect = r[2](await r[1])
    }
}

/**
 * {@link asyncRun} for a runner that is *meant* to lack operations.
 *
 * A command in `commands` with no handler in `map` answers
 * `error(notImplemented)` through the ordinary continuation, so a program that
 * asks for something this runner cannot do gets its control back and decides
 * what that means. A command outside `commands` still panics — see
 * `partialMatch`: an omitted handler and a garbled command are not the same
 * failure.
 *
 * **The injector lives here rather than in `partialMatch`**, for the reason
 * that function gives: the shape of an answer is the runner's, not the
 * operation's. This loop awaits, so its answer is a `Promise`; `mock`'s
 * threads state, so its answer is a function of it. Each writes the one line
 * that says so.
 *
 * @template {Operation} O
 * @param {Commands<O>} commands
 * @returns {<R>(map: PartialOperationMap<O, Promise<R>>) => <T, E>(effect: Effect<O, T, E>) => Promise<Result<T, E>>}
 */
export const asyncPartialRun = commands => map => async effect => {
    /** @type {(command: O[0]) => Promise<any>} */
    const onMissing = async command => error(notImplemented(command))
    const next = partialMatch(commands, onMissing)(map)
    while (true) {
        const r = next(effect)
        if (r[0] === 'done') {
            return r[1]
        }
        effect = r[2](await r[1])
    }
}
