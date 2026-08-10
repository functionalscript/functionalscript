/**
 * Numeric list reductions (`sum`, `min`, `max`), comparison via `cmp`, and
 * `countOnes` for 32-bit population count using SWAR.
 *
 * @module
 */

import { reduce } from '../list/module.f.mjs'
/** @import { List } from '../list/types.ts' */
import { addition } from '../function/operator/module.f.mjs'
/** @import { Reduce } from '../function/operator/types.ts' */
import { cmp as uCmp, min as uMin, max as uMax } from '../function/compare/module.f.mjs'
/** @import { Sign } from '../function/compare/types.ts' */
import { fold } from '../../common/monoid/module.f.mjs'

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

/** @typedef {readonly [number, number]} _MaskOffset */

/** @type {readonly _MaskOffset[]} */
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
