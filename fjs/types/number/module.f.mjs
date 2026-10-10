/**
 * Numeric list reductions (`sum`, `min`, `max`), comparison via `cmp`,
 * `countOnes` for 32-bit population count using SWAR, and the `isUintUpTo`
 * and `isByte` predicates.
 *
 * @module
 *
 * @import { List } from '../list/types.ts'
 * @import { Reduce } from '../function/operator/types.ts'
 * @import { Sign } from '../function/compare/types.ts'
 */

import { reduce } from '../list/module.f.mjs'
import { addition } from '../function/operator/module.f.mjs'
import { cmp as uCmp, min as uMin, max as uMax } from '../function/compare/module.f.mjs'
import { fold } from '../../common/monoid/module.f.mjs'
import { isInteger } from './is_integer/module.f.js'

const { is: sameValue } = Object

/** @type {(input: List<number>) => number} */
export const sum = fold({ identity: 0, operation: addition })

/** @type {Reduce<number>} */
const minReduce = uMin

/** @type {(input: List<number>) => number | null} */
export const min = reduce(minReduce)(null)

/** @type {Reduce<number>} */
const maxReduce = uMax

/** @type {(input: List<number>) => number | null} */
export const max = reduce(maxReduce)(null)

/** @type {(a: number) => (b: number) => Sign} */
export const cmp = uCmp

/** @type {readonly (readonly [number, number])[]} */
const mo = [
    [0x5555_5555, 1],
    [0x3333_3333, 2],
    [0x0F0F_0F0F, 4],
    [0x00FF_00FF, 8],
    [0x0000_FFFF, 16],
]

/**
 * Count a number of ones in 32 bit number
 *
 * @type {(n: number) => number}
 */
export const countOnes = n => {
    for (const [mask, offset] of mo) {
        n = (n & mask) + ((n >> offset) & mask)
    }
    return n
}

/**
 * Whether `n` is an unsigned integer that fits `max`: an integer in `0..max`,
 * and not `-0`, which the data layer refuses as a second spelling of `0`.
 * The one spelling of "a non-negative integer up to `max`" — a byte, an index,
 * a code unit — so whether `-0` is one has one answer. `max` may be
 * `Infinity`, for every non-negative integer.
 *
 * @type {(max: number) => (n: unknown) => n is number}
 */
export const isUintUpTo = max =>
    /**
     * @param {unknown} n
     * @returns {n is number}
     */
    n => typeof n === 'number' && isInteger(n) && 0 <= n && n <= max && !sameValue(n, -0)

/**
 * Whether `b` is a byte: an integer in `0..255`. The one byte predicate, for
 * a consumer that holds a `number` it means as a byte — a `List<number>` it
 * is about to write, say — and has to refuse one that is not.
 */
export const isByte = isUintUpTo(0xFF)
