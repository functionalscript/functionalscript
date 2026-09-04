/**
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { SetInfo, Rule, Infinity, RepeatInfo } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { codePointListToString, stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isFixedArray } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"
import { complement, empty, fromRange, intersection, union as setUnion } from "../types/range_set/module.f.mjs"

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
export const rangeEncode = (a, b) => {
    assert(a <= b)
    const r = /**@type {const}*/(['set', a, b + 1])
    return () => r
}

/** @type {(a: SetInfo) => RangeSet} */
const getSet = a => {
    const [, ...r] = a()
    return r
}

/**
 * @type {<T>(f: (v: T) => RangeSet) =>
 *  (v: readonly T[]) =>
 *  SetInfo}
 */
const unionX = f => v => {
    const r = /**@type {const}*/([
        'set',
        ...v.map(f).reduce(
            (a, b) => setUnion(a)(b),
            empty)])
    return () => r
}

const setUnionX = unionX(b => fromRange([b, b + 1]))

/** @type {(a: string) => SetInfo} */
export const set = a => setUnionX(toArray(stringToCodePointList(a)))

const infoUnionX = unionX(getSet)

/** @type {(...a: SetInfo[]) => SetInfo} */
export const union = (...a) => infoUnionX(a)

/**
 * @type {(a: SetInfo, b: SetInfo) =>
 *  SetInfo}
 */
export const remove = (a, b) => {
    const r = /**@type {const}*/(['set', ...intersection(getSet(a))(complement(getSet(b)))])
    return () => r
}
/**
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatInfo<A, B, R>}
 */
export const repeat =
    (a, b) => rule => () => ['repeat', a, b, rule]

/**
 * @type {<const R extends Rule>(rule: R) =>
 *  RepeatInfo<0, Infinity, R>}
 */
export const repeat0Plus =
    repeat(0, Infinity)

/**
 * @type {<const N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) => RepeatInfo<N, N, R>}
 */
export const times = n => repeat(n, n)

export const unicodeMax =
    codePointListToString([0x10FFFF])
