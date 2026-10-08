/**
 * Impure effect interpretation: runs an `Effect` step by step against an
 * asynchronous operation map.
 *
 * @module
 *
 * @import { Commands, Effect, IoError, MatchResult, Operation, PartialAsyncOperationMap, ToAsyncOperationMap } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { ioError, match, notImplemented, partialMatch, toIoError } from './module.f.mjs'
import { error } from '../types/result/module.f.mjs'
import { tryCatch } from '../types/result/module.mjs'

/**
 * The message of a thrown value that could not be read: one whose own code
 * throws when {@link toIoError} reads it.
 */
export const _unreadableThrownValue = 'thrown value could not be read'

/**
 * Describes a thrown value as an {@link IoError}, whatever it is: the host
 * boundary {@link toIoError} relies on, for a runner's `catch`.
 *
 * Reading a thrown value runs the value's own code — a `toString`, a `code` or
 * `message` getter — and code a runner evaluates, a module it imports or a
 * value it compiles, can throw one that throws in turn. Such a value is outside
 * every `.f.mjs` function's domain, so it is caught here and named rather than
 * read; and a `message` getter can answer `toIoError`'s check and its read
 * differently, so the message is pinned to a string inside the same guard.
 *
 * @type {(e: unknown) => IoError}
 */
export const _describeThrown = e => {
    const r = tryCatch(() => {
        const [, info] = toIoError(e)
        return ioError({ ...info, message: `${info.message}` })
    })
    return r[0] === 'ok' ? r[1] : ioError({ message: _unreadableThrownValue })
}

/**
 * @template {Operation} O
 * @param {ToAsyncOperationMap<O>} map
 * @returns {<T, E>(effect: Effect<O, T, E>) => Promise<Result<T, E>>}
 */
export const asyncRun = map => _asyncLoop(match(map))

/**
 * {@link asyncRun} for a runner that is *meant* to lack operations.
 *
 * A command in `commands` with no handler in `map` answers
 * `error(notImplemented)` through the ordinary continuation, so a program that
 * asks for something this runner cannot do gets its control back and decides
 * what that means. A command outside `commands` still panics — an omitted
 * handler and a garbled command are not the same failure, which is the
 * distinction `partialMatch` exists to keep.
 *
 * **The injector lives here rather than in `partialMatch`**, for the reason
 * that function gives: the shape of an answer is the runner's, not the
 * operation's. This loop awaits, so its answer is a `Promise`; `mock`'s
 * threads state, so its answer is a function of it. Each writes the one line
 * that says so.
 *
 * @template {Operation} O
 * @param {Commands<O>} commands
 * @returns {(map: PartialAsyncOperationMap<O>) => <T, E>(effect: Effect<O, T, E>) => Promise<Result<T, E>>}
 */
export const asyncPartialRun = commands => map => {
    /** @type {(command: O[0]) => Promise<any>} */
    const onMissing = async command => error(notImplemented(command))
    return _asyncLoop(partialMatch(commands, onMissing)(map))
}

/**
 * The interpreter loop both runners share: step the effect, await the
 * command's output, resume with it.
 *
 * @template {Operation} O
 * @param {<O1 extends O, T, E>(e: Effect<O1, T, E>) => MatchResult<O1, T, E, Promise<any>>} next
 * @returns {<T, E>(effect: Effect<O, T, E>) => Promise<Result<T, E>>}
 */
const _asyncLoop = next => async effect => {
    while (true) {
        const r = next(effect)
        if (r[0] === 'done') {
            return r[1]
        }
        effect = r[2](await r[1])
    }
}
