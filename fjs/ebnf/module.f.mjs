/**
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { Set, Rule, Infinity, Repeat, Option, RepeatFrom, Times } from './types.ts'
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
 * @type {(ab: string) => Set}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    assert(isFixedArray2(a))
    return rangeEncode(...a)
}

/**
 * @type {(a: number, b: number) => Set}
 */
export const rangeEncode = (a, b) => {
    assert(a <= b)
    const r = /**@type {const}*/(['set', a, b + 1])
    return () => r
}

/** @type {(a: Set) => RangeSet} */
const rangeSet = a => {
    const [, ...r] = a()
    return r
}

/**
 * @type {<T>(f: (v: T) => RangeSet) =>
 *  (v: readonly T[]) =>
 *  Set}
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

/** @type {(a: string) => Set} */
export const set = a => setUnionX(toArray(stringToCodePointList(a)))

const infoUnionX = unionX(rangeSet)

/** @type {(...a: Set[]) => Set} */
export const union = (...a) => infoUnionX(a)

/**
 * @type {(a: Set, b: Set) =>
 *  Set}
 */
export const remove = (a, b) => {
    const r = /**@type {const}*/([
        'set',
        ...intersection(rangeSet(a))(complement(rangeSet(b)))])
    return () => r
}
/**
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  <const R extends Rule>(rule: R) =>
 *  Repeat<A, B, R>}
 */
export const repeat =
    (a, b) => rule => () => ['repeat', a, b, rule]

/**
 * @type {<N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatFrom<N, R>}
 */
export const repeatFrom = n =>
    repeat(n, Infinity)

export const repeatFrom0 = repeatFrom(0)

/**
 * @type {<const N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) => Times<N, R>}
 */
export const times = n => repeat(n, n)

/** @type {<const R extends Rule>(rule: R) => Option<R>} */
export const option = rule => () => ['repeat', 0, 1, rule]

/**
 * @type {<S extends Rule>(s: S) =>
 *  <R extends Rule>(r: R) =>
 *  Option<[R, RepeatFrom<0, readonly[S, R]>]>}
 */
export const join = s => r => option([r, repeat(0, Infinity)([s, r])])

export const unicodeMax =
    codePointListToString([0x10FFFF])
