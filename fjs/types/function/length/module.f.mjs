/**
 * Build a fixed/rest callable with a given `length` from a statically declared
 * parameter list. The table supports lengths 0 through 32; this is an executor
 * resource limit.
 *
 * @module
 * @import { Body, Callable } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { factories } from './table.f.mjs'

/** A canonical nonnegative integer, including positive zero only. @type {(n: number) => boolean} */
export const isIndex = n => Number.isInteger(n) && n >= 0 && !Object.is(n, -0)

/** @type {(length: number, body: Body) => Callable} */
export const callable = (length, body) => {
    assert(isIndex(length), ['invalid function length', length])
    const factory = factories[length]
    assert(factory !== undefined, ['function length exceeds executor capacity', length, factories.length - 1])
    return factory(body)
}
