/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../ts/types.ts'
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

/** One symbol below the ordinary ones, the shape a grammar spends on EOF. @type {RangeSet} */
const minusOne = rangeSet([-1, 0])

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
        one: () => {
            const has = contains(minusOne)
            assert(!has(-2))
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
        empty: () => assertStructurallySame(toRangeMap(empty), []),
        closed: () => {
            const rm = toRangeMap(digit)
            assertStructurallySame(rm, [[false, c('0') - 1], [true, c('9')]])
            const has = get(false)(rm)
            assert(!has(c('0') - 1))
            assert(has(c('0')))
            assert(has(c('9')))
            assert(!has(c('9') + 1))
        },
        openTail: () => {
            // `Infinity` is an upper bound like any other, so no alphabet
            // maximum closes the tail
            const rm = toRangeMap(nonNegative)
            assertStructurallySame(rm, [[false, -1], [true, Infinity]])
            const has = get(false)(rm)
            assert(!has(-1))
            assert(has(0x110000))
        },
        openBottom: () => {
            // a set with no bottom has no run below its first boundary
            const rm = toRangeMap(negative)
            assertStructurallySame(rm, [[true, -1]])
            const has = get(false)(rm)
            assert(has(-0x110000))
            assert(!has(0))
        },
        universe: () => {
            const rm = toRangeMap(full)
            assertStructurallySame(rm, [[true, Infinity]])
            assert(get(false)(rm)(0))
        },
    },
    // the `Eof` table in `fjs/bnf/todo/ebnf-range-set.md`, each row asserted at
    // the type level and witnessed at runtime by what the set actually contains
    eof: () => {
        const ordinary = fromRange([0, 9])
        /** @typedef {Assert<Equal<typeof ordinary, RangeSet<false>>>} _FromRange */
        assert(!contains(ordinary)(-1))
        /** @typedef {Assert<Equal<typeof empty, RangeSet<false>>>} _Empty */
        /** @typedef {Assert<Equal<typeof full, RangeSet<true>>>} _Full */

        // a literal that opens at `-1` carries it, which is what the `const`
        // type parameter is for
        const eofOnly = rangeSet([-1, 0])
        /** @typedef {Assert<Equal<typeof eofOnly, RangeSet<true>>>} _RangeSetLiteral */
        assert(contains(eofOnly)(-1))

        // boundaries the caller did not write down say nothing
        /** @type {readonly number[]} */
        const elsewhere = [-1, 0]
        const unknown = rangeSet(elsewhere)
        /** @typedef {Assert<Equal<typeof unknown, RangeSet<boolean>>>} _RangeSetWidened */

        const notOrdinary = complement(ordinary)
        /** @typedef {Assert<Equal<typeof notOrdinary, RangeSet<true>>>} _Complement */
        assert(contains(notOrdinary)(-1))
        const notEofOnly = complement(eofOnly)
        /** @typedef {Assert<Equal<typeof notEofOnly, RangeSet<false>>>} _ComplementBack */
        assert(!contains(notEofOnly)(-1))

        const united = union(eofOnly)(ordinary)
        /** @typedef {Assert<Equal<typeof united, RangeSet<true>>>} _Union */
        assert(contains(united)(-1))

        const intersected = intersection(eofOnly)(ordinary)
        /** @typedef {Assert<Equal<typeof intersected, RangeSet<false>>>} _Intersection */
        assert(!contains(intersected)(-1))

        const differenced = difference(full)(eofOnly)
        /** @typedef {Assert<Equal<typeof differenced, RangeSet<false>>>} _Difference */
        assert(!contains(differenced)(-1))

        // unknown on either side stays unknown
        const widened = union(unknown)(ordinary)
        /** @typedef {Assert<Equal<typeof widened, RangeSet<boolean>>>} _UnionUnknown */
        assert(contains(widened)(-1))
    },
    throw: {
        rangeSetRejectsUnsorted: () => rangeSet([5, 5]),
        rangeSetRejectsNonInteger: () => rangeSet([0.5]),
        rangeSetRejectsInfiniteTail: () => rangeSet([0, Infinity]),
        fromRangeRejectsReversed: () => fromRange([9, 0]),
    },
}
