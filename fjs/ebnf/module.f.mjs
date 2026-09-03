/**
 * @import { Info, RangeInfo, Rule, Infinity, RepeatInfo } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isTuple } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"

const isTuple2 =
    isTuple(2)

/**
 * Encodes a two-symbol string into a terminal range.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 *
 * @type {(ab: string) =>
 *  RangeInfo<number, number>}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    assert(isTuple2(a))
    return rangeEncode(...a)
}

/**
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  RangeInfo<A, B>}
 */
export const rangeEncode = (a, b) => (
    assert(a <= b),
    () => ['range', a, b]
)

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
