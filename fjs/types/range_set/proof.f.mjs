/**
 * @import { RangeSet } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
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
    toRangeMap,
    union,
} from './module.f.mjs'
import { get } from '../range_map/module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.charCodeAt(0)

/** The two boundaries of `'0'..'9'`. @type {RangeSet} */
const digit = fromRange([c('0'), c('9')])

/** Every integer below zero. @type {RangeSet} */
const negative = rangeSet([-Infinity, 0])

/** Every integer from zero up, an open tail. @type {RangeSet} */
const nonNegative = rangeSet([0])

export const proof = {
    isRangeSet: () => {
        assert(isRangeSet(empty))
        assert(isRangeSet(full))
        assert(isRangeSet([-Infinity, 0, 0x110000]))
        // not strictly increasing
        assert(!isRangeSet([5, 5]))
        assert(!isRangeSet([5, 4]))
        // not integers
        assert(!isRangeSet([0.5]))
        assert(!isRangeSet([0, 0.5]))
        // `-Infinity` opens the universe; nothing else here is a boundary
        assert(!isRangeSet([0, -Infinity]))
        assert(!isRangeSet([Infinity]))
        assert(!isRangeSet([0, Infinity]))
    },
    rangeSet: () => {
        const s = rangeSet([0x30, 0x3A])
        assertStructurallySame(s, digit)
    },
    fromRange: () => {
        assertStructurallySame(fromRange([c('0'), c('9')]), [0x30, 0x3A])
        // a single symbol
        assertStructurallySame(fromRange([c('a'), c('a')]), [0x61, 0x62])
    },
    contains: {
        empty: () => {
            const has = contains(empty)
            assert(!has(-1))
            assert(!has(0))
        },
        full: () => {
            const has = contains(full)
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
            const letters = union(fromRange([c('A'), c('Z')]))(fromRange([c('a'), c('z')]))
            assertStructurallySame(letters, [c('A'), c('Z') + 1, c('a'), c('z') + 1])
        },
        // adjacent ranges collapse into one, which is what canonical means
        adjacent: () => assertStructurallySame(
            union(fromRange([0, 4]))(fromRange([5, 9])),
            fromRange([0, 9])),
        overlapping: () => assertStructurallySame(
            union(fromRange([0, 6]))(fromRange([5, 9])),
            fromRange([0, 9])),
        identity: () => assertStructurallySame(union(digit)(empty), digit),
        openTail: () => assertStructurallySame(union(nonNegative)(negative), full),
    },
    intersection: {
        overlapping: () => assertStructurallySame(
            intersection(fromRange([0, 6]))(fromRange([5, 9])),
            fromRange([5, 6])),
        disjoint: () => assertStructurallySame(
            intersection(fromRange([0, 4]))(fromRange([5, 9])),
            empty),
        identity: () => assertStructurallySame(intersection(digit)(full), digit),
    },
    difference: {
        inner: () => assertStructurallySame(
            difference(fromRange([0, 9]))(fromRange([4, 5])),
            union(fromRange([0, 3]))(fromRange([6, 9]))),
        // an alphabet-scoped complement: everything but the digits, over an
        // alphabet that starts at zero
        alphabet: () => assertStructurallySame(
            difference(nonNegative)(digit),
            union(fromRange([0, c('0') - 1]))(rangeSet([c('9') + 1]))),
        whole: () => assertStructurallySame(difference(digit)(full), empty),
    },
    toRangeMap: {
        empty: () => assertStructurallySame(toRangeMap(0x10FFFF)(empty), []),
        closed: () => {
            const rm = toRangeMap(0x10FFFF)(digit)
            assertStructurallySame(rm, [[false, c('0') - 1], [true, c('9')]])
            const has = get(false)(rm)
            assert(!has(c('0') - 1))
            assert(has(c('0')))
            assert(has(c('9')))
            assert(!has(c('9') + 1))
        },
        openTail: () => {
            // the alphabet's maximum is what a set running to `Infinity` is
            // closed with
            const rm = toRangeMap(0x10FFFF)(full)
            assertStructurallySame(rm, [[false, -Infinity], [true, 0x10FFFF]])
            assert(get(false)(rm)(0))
        },
        // `max + 1` is a boundary, not a member: it closes the alphabet
        top: () => assertEq(toRangeMap(0x10FFFF)(rangeSet([0, 0x110000])).length, 2),
    },
    throw: {
        rangeSetRejectsUnsorted: () => rangeSet([5, 5]),
        rangeSetRejectsNonInteger: () => rangeSet([0.5]),
        fromRangeRejectsReversed: () => fromRange([9, 0]),
        toRangeMapRejectsAboveMaximum: () => toRangeMap(0x10FFFF)(rangeSet([0, 0x110001])),
    },
}
