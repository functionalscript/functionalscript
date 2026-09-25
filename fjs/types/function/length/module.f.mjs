/**
 * Build a fixed/rest callable with a given `length` from a statically declared
 * parameter list. The table covers every length the language admits, 0
 * through {@link maxLength}.
 *
 * @module
 * @import { Body, Callable } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { factories } from './table.f.mjs'

/** The most fixed parameters a FunctionalScript function has: its largest `length`. */
export const maxLength = 16

/** A canonical nonnegative integer, including positive zero only. @type {(n: number) => boolean} */
export const isIndex = n => Number.isInteger(n) && n >= 0 && !Object.is(n, -0)

/** @type {(length: number, body: Body) => Callable} */
export const callable = (length, body) => {
    assert(isIndex(length) && length <= maxLength, ['invalid function length', length])
    return factories[length](body)
}
