/**
 * @import { RangeSet } from './types.ts'
 */

import { assert, assertStructurallySame } from '../../asserts/module.f.mjs'
import {
    complement,
    contains,
    difference,
    empty,
    fromRange,
    full,
    intersection,
    isRangeSet,
    rangeSet,
    union,
} from './module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.charCodeAt(0)

/** The digits, whose closed range `'0'..'9'` a caller spells `[a, b + 1]`. @type {RangeSet} */
const digit = fromRange([c('0'), c('9') + 1])

/** Every number below zero. @type {RangeSet} */
const negative = rangeSet([-Infinity, 0])

/** Every number from zero up, an open tail. @type {RangeSet} */
const nonNegative = rangeSet([0])

/** The one integer below the ordinary symbols, the shape a grammar spends on EOF. @type {RangeSet} */
const minusOne = rangeSet([-1, 0])

/** A run between two integers, which no integer alphabet can spell. @type {RangeSet} */
const fraction = fromRange([0.5, 1.5])

export const proof = {
    isRangeSet: () => {
        assert(isRangeSet(empty))
        assert(isRangeSet(full))
        assert(isRangeSet([-Infinity, 0, 0x110000]))
        // any number is a boundary, integer or not
        assert(isRangeSet([0.5, 1.5]))
        // not strictly increasing: a repeat, and a decrease
        assert(!isRangeSet([5, 5]))
        assert(!isRangeSet([5, 4]))
        // a hole is no boundary, and `Array#every` alone would skip it
        assert(!isRangeSet(new Array(1)))
        assert(!isRangeSet(new Array(2)))
        // `NaN` has no order, and one alone is never compared
        assert(!isRangeSet([NaN]))
        assert(!isRangeSet([0, NaN]))
        // `[Infinity]` would be a second spelling of `[]`, `-0` one of `0`
        assert(!isRangeSet([Infinity]))
        assert(!isRangeSet([0, Infinity]))
        assert(!isRangeSet([-0]))
        assert(!isRangeSet([-0, 1]))
        // `-Infinity` opens a set, so nothing can precede it
        assert(!isRangeSet([0, -Infinity]))
    },
    rangeSet: () => {
        const s = rangeSet([0x30, 0x3A])
        assertStructurallySame(s, digit)
    },
    fromRange: () => {
        assertStructurallySame(fromRange([0.5, 1.5]), fraction)
        // one symbol of an integer alphabet
        assertStructurallySame(fromRange([c('a'), c('a') + 1]), [0x61, 0x62])
    },
    contains: {
        empty: () => {
            const has = contains(empty)
            assert(!has(-1))
            assert(!has(0))
        },
        full: () => {
            const has = contains(full)
            // the universe's bottom is a member of it
            assert(has(-Infinity))
            assert(has(-1))
            assert(has(0x110000))
        },
        closed: () => {
            const has = contains(digit)
            assert(!has(c('0') - 1))
            assert(has(c('0')))
            assert(has(c('9')))
            assert(!has(c('9') + 1))
        },
        openTail: () => {
            const has = contains(nonNegative)
            assert(!has(-1))
            assert(has(0))
            assert(has(0x110000))
        },
        openBottom: () => {
            const has = contains(negative)
            assert(has(-0x110000))
            assert(has(-1))
            assert(!has(0))
        },
        one: () => {
            const has = contains(minusOne)
            assert(!has(-2))
            assert(has(-1))
            assert(!has(0))
        },
        // the lower boundary is in the set and the upper one is not, which is
        // what half-open means where there is no successor to hide it
        fraction: () => {
            const has = contains(fraction)
            assert(!has(0.25))
            assert(has(0.5))
            assert(has(1))
            assert(!has(1.5))
        },
    },
    complement: {
        // one toggle at the bottom of the universe, in both directions
        add: () => assertStructurallySame(complement(nonNegative), negative),
        remove: () => assertStructurallySame(complement(negative), nonNegative),
        involution: () => assertStructurallySame(complement(complement(digit)), digit),
        empty: () => assertStructurallySame(complement(empty), full),
    },
    union: {
        disjoint: () => {
            const letters = union(fromRange([c('A'), c('Z') + 1]))(fromRange([c('a'), c('z') + 1]))
            assertStructurallySame(letters, [c('A'), c('Z') + 1, c('a'), c('z') + 1])
        },
        // touching runs collapse into one, which is what canonical means
        adjacent: () => assertStructurallySame(
            union(fromRange([0, 5]))(fromRange([5, 10])),
            fromRange([0, 10])),
        overlapping: () => assertStructurallySame(
            union(fromRange([0, 7]))(fromRange([5, 10])),
            fromRange([0, 10])),
        identity: () => assertStructurallySame(union(digit)(empty), digit),
        openTail: () => assertStructurallySame(union(nonNegative)(negative), full),
    },
    intersection: {
        overlapping: () => assertStructurallySame(
            intersection(fromRange([0, 7]))(fromRange([5, 10])),
            fromRange([5, 7])),
        disjoint: () => assertStructurallySame(
            intersection(fromRange([0, 5]))(fromRange([5, 10])),
            empty),
        identity: () => assertStructurallySame(intersection(digit)(full), digit),
        fraction: () => assertStructurallySame(
            intersection(fraction)(nonNegative),
            fraction),
    },
    difference: {
        inner: () => assertStructurallySame(
            difference(fromRange([0, 10]))(fromRange([4, 6])),
            union(fromRange([0, 4]))(fromRange([6, 10]))),
        // an alphabet-scoped complement: everything but the digits, over an
        // alphabet that starts at zero
        alphabet: () => assertStructurallySame(
            difference(nonNegative)(digit),
            union(fromRange([0, c('0')]))(rangeSet([c('9') + 1]))),
        whole: () => assertStructurallySame(difference(digit)(full), empty),
    },
    throw: {
        rangeSetRejectsRepeat: () => rangeSet([5, 5]),
        rangeSetRejectsDecrease: () => rangeSet([5, 4]),
        rangeSetRejectsHole: () => rangeSet(new Array(1)),
        // outside the universe there is no answer to give: such a value would
        // be in neither a set nor the complement of one
        containsRejectsNaN: () => contains(full)(NaN),
        containsRejectsInfinity: () => contains(full)(Infinity),
        rangeSetRejectsNaN: () => rangeSet([NaN]),
        rangeSetRejectsInfinity: () => rangeSet([0, Infinity]),
        rangeSetRejectsNegativeZero: () => rangeSet([-0]),
        fromRangeRejectsReversed: () => fromRange([9, 0]),
    },
}
