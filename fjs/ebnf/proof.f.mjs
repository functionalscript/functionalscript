/**
 * @import { Set } from './types.ts'
 */

import { assertStructurallySame } from '../asserts/module.f.mjs'
import {
    eof,
    join,
    option,
    range,
    rangeEncode,
    remove,
    repeat,
    repeatFrom,
    repeatFrom0,
    repeatFrom1,
    set,
    times,
    unicodeMax,
    union,
} from './module.f.mjs'
import { force } from './testlib.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The boundaries a `SetInfo` carries. Every constructor returns a thunk, so
 * reading one is what proves the thunk itself runs.
 *
 * @type {(a: Set) => readonly number[]}
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
    // EOF is the one plain rule that is not a symbol, a string or a container.
    eof: () => {
        assertStructurallySame(eof, null)
    },
    rangeEncode: () => {
        assertStructurallySame(boundaries(rangeEncode(0, 7)), [0, 8])
        assertStructurallySame(boundaries(rangeEncode(3, 3)), [3, 4])
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
        bounds: () => {
            assertStructurallySame(repeat(2, 5)('a')(), ['repeat', 2, 5, 'a'])
        },
        // The derived constructors are the same shape with fixed bounds:
        // `repeatFrom(n)` is open above, and the two named bounds are its
        // partial applications.
        from: () => {
            assertStructurallySame(repeatFrom(2)('a')(), ['repeat', 2, Infinity, 'a'])
        },
        zeroPlus: () => {
            assertStructurallySame(repeatFrom0('a')(), ['repeat', 0, Infinity, 'a'])
        },
        onePlus: () => {
            assertStructurallySame(repeatFrom1('a')(), ['repeat', 1, Infinity, 'a'])
        },
        times: () => {
            assertStructurallySame(times(4)('a')(), ['repeat', 4, 4, 'a'])
        },
        option: () => {
            assertStructurallySame(option('a')(), ['repeat', 0, 1, 'a'])
        },
        // A rule is any rule, including a nested thunk.
        nested: () => {
            const inner = range('09')
            assertStructurallySame(times(2)(inner)(), ['repeat', 2, 2, inner])
        },
    },
    // A separated list is an optional first item followed by any number of
    // separator-item pairs, so an empty list is one too.
    join: () => {
        assertStructurallySame(
            force(join(',')('a')),
            ['repeat', 0, 1, ['a', ['repeat', 0, Infinity, [',', 'a']]]])
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
        // An ordinary symbol is a non-negative safe integer, and so is the
        // boundary above the range's top. Each of these would otherwise
        // encode a range that is not the one asked for: `[-1, 2]` gets
        // clipped to `[0, 2]` by the algebra's domain, a fractional endpoint
        // sorts between two symbols that have nothing between them, and
        // `MAX_SAFE_INTEGER + 1` is not distinct from `MAX_SAFE_INTEGER`.
        rangeEncodeRejectsNegative: () => rangeEncode(-1, 1),
        rangeEncodeRejectsFractional: () => rangeEncode(0, 1.5),
        rangeEncodeRejectsUnsafeTop: () =>
            rangeEncode(0, Number.MAX_SAFE_INTEGER),
    },
}
