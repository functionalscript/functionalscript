/**
 * Impure effect interpretation: runs a `RawEffect` step by step against an
 * asynchronous operation map.
 *
 * @module
 *
 * @import { RawEffect, Operation, ToAsyncOperationMap } from './types.ts'
 */

import { match } from './module.f.mjs'

/**
 * @template {Operation} O
 * @param {ToAsyncOperationMap<O>} map
 * @returns {<T>(effect: RawEffect<O, T>) => Promise<T>}
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
