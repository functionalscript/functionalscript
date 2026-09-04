/**
 * The EBNF front end: the constructors a grammar is written with.
 *
 * A terminal is a set of symbol ranges rather than a single symbol, so the
 * range-set algebra in `types/range_set` is what `set`, `union` and `remove`
 * lift here. Everything else is `repeat` with its bounds fixed. See
 * `./types.ts` for what the constructors build.
 *
 * @module
 *
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { Set, Rule, Infinity, Repeat, Option, RepeatFrom, Times } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { codePointListToString, stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isFixedArray } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"
import { complement, empty, fromRange, intersection, union as setUnion } from "../types/range_set/module.f.mjs"

const { isSafeInteger } = Number

const isFixedArray2 =
    isFixedArray(2)

/**
 * An ordinary symbol is a non-negative safe integer. The ceiling is
 * arithmetic rather than alphabetic: `b + 1` below is exact only for safe
 * integers — `2 ** 53 + 1` is `2 ** 53` — so a boundary outside that range
 * would name a different range than the one asked for.
 *
 * @type {(a: number) => boolean}
 */
const isSymbol = a => isSafeInteger(a) && a >= 0

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
 * Encodes a closed range of symbols as a terminal, exclusive above.
 *
 * @throws If either endpoint is not an ordinary symbol, if the range runs
 * backwards, or if the exclusive boundary above `b` is not a symbol either —
 * a call site that hands over one of those has made a mistake, and answering
 * it with a plausible range would hide that.
 *
 * @type {(a: number, b: number) => Set}
 */
export const rangeEncode = (a, b) => {
    assert(isSymbol(a) && isSymbol(b) && a <= b && isSymbol(b + 1))
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
export const repeatFrom1 = repeatFrom(1)

/**
 * @type {<const N extends number>(n: N) =>
 *  <const R extends Rule>(rule: R) => Times<N, R>}
 */
export const times = n => repeat(n, n)

/** @type {<const R extends Rule>(rule: R) => Option<R>} */
export const option = rule => () => ['repeat', 0, 1, rule]

/**
 * @type {<const S extends Rule>(s: S) =>
 *  <const R extends Rule>(r: R) =>
 *  Option<readonly[R, RepeatFrom<0, readonly[S, R]>]>}
 */
export const join = s => r => option([r, repeatFrom0([s, r])])

/**
 * The end of input, as a rule. A grammar that must consume the whole input
 * ends in it: `[value, eof]`.
 *
 * @type {null}
 */
export const eof = null

export const unicodeMax =
    codePointListToString([0x10FFFF])
