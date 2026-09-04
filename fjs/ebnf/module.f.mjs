/**
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { SetInfo, Rule, Infinity, RepeatInfo } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isFixedArray } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"
import { complement, intersection } from "../types/range_set/module.f.mjs"

const isFixedArray2 =
    isFixedArray(2)

/**
 * Encodes a two-symbol string into a terminal range.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 *
 * @type {(ab: string) => SetInfo}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    assert(isFixedArray2(a))
    return rangeEncode(...a)
}

/**
 * @type {(a: number, b: number) => SetInfo}
 */
export const rangeEncode = (a, b) => (
    assert(a <= b),
    () => ['set', a, b + 1]
)

/** @type {(a: SetInfo) => RangeSet} */
const getSet = a => {
    const [, ...r] = a()
    return r
}

/**
 * @type {(a: SetInfo) =>
 *  (b: SetInfo) =>
 *  SetInfo}
 */
export const remove =
    a => b => () => ['set', ...intersection(getSet(a))(complement(getSet(b)))]

/**
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatInfo<A, B, R>}
 */
export const repeat =
    (a, b) => rule => () => ['repeat', a, b, rule]

/** @type {<const R extends Rule>(rule: R) => RepeatInfo<0, Infinity, R>} */
export const repeat0Plus =
    repeat(0, Infinity)
