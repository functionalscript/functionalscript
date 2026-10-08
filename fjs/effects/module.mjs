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
 * throws when {@link _readThrown} reads it.
 */
export const _unreadableThrownValue = 'thrown value could not be read'

/**
 * Reads a thrown value into data FunctionalScript can build, before
 * {@link toIoError} sees it: the value's string form, or for an object, its
 * string `message` (else its string form) and its `code` if that is a string.
 *
 * This is the host boundary a runner's `catch` owes. Code a runner evaluates —
 * a module it imports, a value it compiles — can throw anything, and an object
 * with getters, a hostile `toString`, or one from another realm is outside every
 * `.f.mjs` function's domain. Each field is read once, so a getter cannot answer
 * the test and the read differently. Reading runs the value's own code, so this
 * throws whatever that code throws.
 *
 * @type {(e: unknown) => string | { readonly message: string, readonly code?: string }}
 */
export const _readThrown = e => {
    if (typeof e !== 'object' || e === null) {
        return String(e)
    }
    /** @type {{ readonly message?: unknown, readonly code?: unknown }} */
    const fields = e
    const { message, code } = fields
    const text = typeof message === 'string' ? message : String(e)
    return typeof code === 'string' ? { message: text, code } : { message: text }
}

/**
 * Describes a thrown value as an {@link IoError}, whatever it is: read by
 * {@link _readThrown}, or named by {@link _unreadableThrownValue} when reading
 * it throws.
 *
 * @type {(e: unknown) => IoError}
 */
export const _describeThrown = e => {
    const r = tryCatch(() => _readThrown(e))
    return r[0] === 'ok' ? toIoError(r[1]) : ioError({ message: _unreadableThrownValue })
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
