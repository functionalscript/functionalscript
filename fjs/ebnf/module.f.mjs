/**
 * The rule vocabulary an EBNF grammar is written in: terminal sets carried as
 * `range_set` boundary lists, and the repetition rule that closes over them.
 *
 * A terminal set is **half-open above** — the closed symbol range `a..b` is the
 * boundary pair `[a, b + 1]`. That `+ 1` is a fact about integers, which is why
 * it lives here, at the layer that knows a symbol is a code point, rather than
 * in `types/range_set`, where boundaries are only ever compared.
 *
 * Every constructor returns a thunk, so a grammar can name a rule before the
 * rule is defined and recursion terminates at the reference.
 *
 * @module
 *
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
 * The closed symbol range `a..b`, as the half-open boundary pair `[a, b + 1]`.
 *
 * Both endpoints are checked, not only their order: `b + 1` has to be a
 * boundary *above* `a`, which it is for a safe integer and is not for
 * `Infinity`, which is outside the universe, nor for a magnitude where
 * `b + 1 === b`. A range built from those is not a set the algebra can read, so
 * it is refused here rather than handed out to panic inside whichever of
 * `union`, `remove` or `contains` composed it next. `fromRange` is the door the
 * pair goes through, which is what also rules out `-0` as a bound.
 *
 * @throws If `a` or `b` is not a safe integer, if `b < a`, or if the pair is
 * not a boundary pair.
 *
 * @type {(a: number, b: number) => SetInfo}
 */
export const rangeEncode = (a, b) => {
    assert(Number.isSafeInteger(a) && Number.isSafeInteger(b) && a <= b, [a, b])
    const r = /**@type {const}*/(['set', ...fromRange([a, b + 1])])
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
    const r = /**@type {const}*/([
        'set',
        ...intersection(getSet(a))(complement(getSet(b)))])
    return () => r
}

/**
 * A repetition bound below: a count of matches, so a non-negative safe integer.
 *
 * @type {(v: number) => boolean}
 */
const isCount = v => Number.isSafeInteger(v) && v >= 0

/**
 * A repetition bound above: a count, or `Infinity` for an unbounded repeat.
 *
 * @type {(v: number) => boolean}
 */
const isMax = v => v === Infinity || isCount(v)

/**
 * `a` to `b` matches of `rule`, where `b` may be `Infinity`.
 *
 * The bounds are checked where they are bound rather than where the rule is
 * read: a negative, fractional or reversed cardinality is no repetition a
 * parser can carry out, and a rule spelling one would be a plausible wrong
 * value handed back in place of a refusal.
 *
 * @throws If `a` is not a count, if `b` is neither a count nor `Infinity`, or
 * if `b < a`.
 *
 * @type {<const A extends number, const B extends number>(a: A, b: B) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatInfo<A, B, R>}
 */
export const repeat = (a, b) => {
    assert(isCount(a) && isMax(b) && a <= b, [a, b])
    return rule => () => ['repeat', a, b, rule]
}

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

/** @type {<const R extends Rule>(rule: R) => RepeatInfo<0, 1, R>} */
export const option = repeat(0, 1)

export const unicodeMax =
    codePointListToString([0x10FFFF])
