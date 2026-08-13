/**
 * Impure `Result` companions: capture thrown exceptions as `Result` values,
 * since `try`/`catch` is not allowed in FunctionalScript itself.
 *
 * @module
 *
 * @import { Result } from './types.ts'
 */

import { ok, error } from './module.f.mjs'

/** @type {<T>(f: () => T) => Result<T, unknown>} */
export const tryCatch = f => {
    // Side effect: `try catch` is not allowed in FunctionalScript.
    try {
        return ok(f())
    } catch (e) {
        return error(e)
    }
}

/** @type {<T>(f: () => Promise<T>) => Promise<Result<T, unknown>>} */
export const asyncTryCatch = async f => {
    // Side effect: `try catch` is not allowed in FunctionalScript.
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}
