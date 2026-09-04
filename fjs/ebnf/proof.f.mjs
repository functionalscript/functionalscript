/**
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { SetInfo } from './types.ts'
 */

import { assertStructurallySame } from '../asserts/module.f.mjs'
import {
    option,
    range,
    rangeEncode,
    remove,
    repeat,
    repeat0Plus,
    set,
    times,
    unicodeMax,
    union,
} from './module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The boundaries a `SetInfo` carries. Every constructor returns a thunk, so
 * reading one is what proves the thunk itself runs.
 *
 * @type {(a: SetInfo) => readonly number[]}
 */
const boundaries = a => {
    const [, ...r] = a()
    return r
}

export const proof = {
    // A closed two-symbol range, exclusive above: `'0'..'9'` is `[48, 58]`.
    range: () => {
        assertStructurallySame(boundaries(range('09')), [c('0'), c('9') + 1])
    },
    // One symbol is still a range, and the caller spells it with the symbol
    // twice rather than with a second constructor.
    rangeOfOne: () => {
        assertStructurallySame(boundaries(range('aa')), [c('a'), c('a') + 1])
    },
    // A code point above the BMP is one symbol, not the two UTF-16 units that
    // spell it — which is why the bound is taken from the code point list.
    rangeAstral: () => {
        assertStructurallySame(
            boundaries(range(` ${unicodeMax}`)),
            [c(' '), 0x10FFFF + 1])
    },
    // `unicodeMax` is the character, not its number: interpolating a number
    // would spell its decimal digits and make the range above eight symbols.
    // One code point, spelled by two UTF-16 units — which is why a bound is
    // read off the code point list rather than off `.length`.
    unicodeMax: () => {
        assertStructurallySame([...unicodeMax].length, 1)
        assertStructurallySame(unicodeMax.length, 2)
        assertStructurallySame(unicodeMax.codePointAt(0), 0x10FFFF)
    },
    rangeEncode: () => {
        assertStructurallySame(boundaries(rangeEncode(0, 7)), [0, 8])
        assertStructurallySame(boundaries(rangeEncode(3, 3)), [3, 4])
        // A negative symbol is a bound like any other: only the algebra's own
        // rules on a boundary apply here, not an alphabet's.
        assertStructurallySame(boundaries(rangeEncode(-2, -1)), [-2, 0])
    },
    set: {
        // Adjacent symbols coalesce into one run, in either order given.
        adjacent: () => {
            assertStructurallySame(boundaries(set('ab')), [c('a'), c('b') + 1])
            assertStructurallySame(boundaries(set('ba')), [c('a'), c('b') + 1])
        },
        // A gap stays a gap: two runs, not one.
        gap: () => {
            assertStructurallySame(
                boundaries(set('ac')),
                [c('a'), c('a') + 1, c('c'), c('c') + 1])
        },
        // A repeated symbol is the same set as one of it.
        duplicate: () => {
            assertStructurallySame(boundaries(set('aa')), boundaries(set('a')))
        },
        // No symbols is the empty set, which is a set rather than a mistake.
        empty: () => {
            assertStructurallySame(boundaries(set('')), [])
        },
    },
    union: {
        // Union of disjoint ranges keeps both runs.
        disjoint: () => {
            assertStructurallySame(
                boundaries(union(range('09'), range('af'))),
                [c('0'), c('9') + 1, c('a'), c('f') + 1])
        },
        // Overlapping ranges merge, so the result is one run.
        overlapping: () => {
            assertStructurallySame(
                boundaries(union(range('09'), range('5A'))),
                [c('0'), c('A') + 1])
        },
        // No arguments is the empty set — the identity the fold starts from.
        none: () => {
            assertStructurallySame(boundaries(union()), [])
        },
    },
    remove: {
        // The motivating case: every symbol from a space up, minus the two a
        // JSON string cannot carry raw.
        excluded: () => {
            const r = boundaries(remove(range(' ~'), set('"\\')))
            assertStructurallySame(
                r,
                [c(' '), c('"'), c('"') + 1, c('\\'), c('\\') + 1, c('~') + 1])
        },
        // Removing what is not there changes nothing.
        disjoint: () => {
            assertStructurallySame(
                boundaries(remove(range('09'), range('af'))),
                [c('0'), c('9') + 1])
        },
        // Removing a superset leaves nothing.
        all: () => {
            assertStructurallySame(boundaries(remove(range('09'), range('09'))), [])
        },
    },
    repeat: {
        // The bounds and the rule are carried verbatim.
        //
        // Each `@typedef` below is the only thing standing between a `const`
        // type parameter and a rule that widens on the way in, and each one
        // passes a *variant literal* to be worth writing. A lone `'a'` is
        // inferred as `'a'` either way, because `Rule` admits `string` and a
        // type parameter constrained to a primitive keeps the literal; a
        // variant is what widens, to `{ b: string }`, mutable and with the
        // alternative's own spelling gone. Dropping a `const` fails these and
        // nothing else in the suite.
        bounds: () => {
            const r = repeat(2, 5)({ b: 'c' })
            /** @typedef {Assert<Equal<ReturnType<typeof r>, readonly['repeat', 2, 5, { readonly b: 'c' }]>>} _Const */
            assertStructurallySame(r(), ['repeat', 2, 5, { b: 'c' }])
        },
        // A repeat may match nothing at all, which is a cardinality rather
        // than a mistake.
        empty: () => {
            assertStructurallySame(repeat(0, 0)('a')(), ['repeat', 0, 0, 'a'])
        },
        // The three derived constructors are the same shape with fixed bounds.
        // `Infinity` is `number` at the type level, which is why the bound
        // asserted here is `number` and not a literal.
        zeroPlus: () => {
            const r = repeat0Plus({ b: 'c' })
            /** @typedef {Assert<Equal<ReturnType<typeof r>, readonly['repeat', 0, number, { readonly b: 'c' }]>>} _Const */
            assertStructurallySame(r(), ['repeat', 0, Infinity, { b: 'c' }])
        },
        times: () => {
            const r = times(4)({ b: 'c' })
            /** @typedef {Assert<Equal<ReturnType<typeof r>, readonly['repeat', 4, 4, { readonly b: 'c' }]>>} _Const */
            assertStructurallySame(r(), ['repeat', 4, 4, { b: 'c' }])
        },
        option: () => {
            const r = option({ b: 'c' })
            /** @typedef {Assert<Equal<ReturnType<typeof r>, readonly['repeat', 0, 1, { readonly b: 'c' }]>>} _Const */
            assertStructurallySame(r(), ['repeat', 0, 1, { b: 'c' }])
        },
        // A rule is any rule, including a nested thunk.
        nested: () => {
            const inner = range('09')
            assertStructurallySame(times(2)(inner)(), ['repeat', 2, 2, inner])
        },
    },
    throw: {
        // `range` takes exactly two symbols: one is not a range, and three is
        // not one either.
        rangeRejectsOne: () => range('a'),
        rangeRejectsThree: () => range('abc'),
        rangeRejectsEmpty: () => range(''),
        // An astral symbol is one code point, so a pair of them is two — but
        // the four UTF-16 units they occupy are not four symbols.
        rangeRejectsOneAstral: () => range(unicodeMax),
        // A reversed range is a mistake rather than an empty set.
        rangeEncodeRejectsReversed: () => rangeEncode(7, 0),
        // `a <= b` alone would pass each of these, and `b + 1` would then be
        // no boundary above `a`: `Infinity` is outside the universe, and at
        // this magnitude the successor is the number itself.
        rangeEncodeRejectsInfinity: () => rangeEncode(Infinity, Infinity),
        rangeEncodeRejectsUnsafe: () => rangeEncode(0, Number.MAX_VALUE),
        rangeEncodeRejectsFraction: () => rangeEncode(0.5, 1.5),
        rangeEncodeRejectsNaN: () => rangeEncode(NaN, NaN),
        // `-0` is a second spelling of `0`, so it is no boundary — the pair
        // goes through `fromRange`, which is what catches it.
        rangeEncodeRejectsNegativeZero: () => rangeEncode(-0, 1),
        // A repetition bound is a count: `Infinity` is one only above.
        repeatRejectsNegativeMin: () => repeat(-1, 5),
        repeatRejectsFractionalMin: () => repeat(0.5, 5),
        repeatRejectsNegativeMax: () => repeat(0, -1),
        repeatRejectsFractionalMax: () => repeat(0, 1.5),
        repeatRejectsInfiniteMin: () => repeat(Infinity, Infinity),
        repeatRejectsReversed: () => repeat(2, 1),
    },
}
