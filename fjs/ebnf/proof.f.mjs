/**
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { SetInfo } from './types.ts'
 */

import { assertStructurallySame } from '../asserts/module.f.mjs'
import { difference, union } from '../types/range_set/module.f.mjs'
import {
    oneOf,
    option,
    range,
    rangeEncode,
    repeat,
    repeat0Plus,
    set,
    times,
    unicodeMax,
} from './module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The boundaries a rule carries. Every rule constructor returns a thunk, so
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
    // The constructors below return set *values*, so a proof reads them
    // directly; `oneOf` is what a grammar puts between one and a rule.
    range: () => {
        assertStructurallySame(range('09'), [c('0'), c('9') + 1])
    },
    // One symbol is still a range, and the caller spells it with the symbol
    // twice rather than with a second constructor.
    rangeOfOne: () => {
        assertStructurallySame(range('aa'), [c('a'), c('a') + 1])
    },
    // A code point above the BMP is one symbol, not the two UTF-16 units that
    // spell it — which is why the bound is taken from the code point list.
    rangeAstral: () => {
        assertStructurallySame(range(` ${unicodeMax}`), [c(' '), 0x10FFFF + 1])
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
    rangeEncode: {
        pair: () => {
            assertStructurallySame(rangeEncode(0, 7), [0, 8])
            assertStructurallySame(rangeEncode(3, 3), [3, 4])
        },
        // The top symbol has no boundary above it — `2 ** 53` is not safe — so
        // a range that reaches it is the open tail, its only spelling.
        top: () => {
            const top = Number.MAX_SAFE_INTEGER
            assertStructurallySame(rangeEncode(top, top), [top])
            assertStructurallySame(rangeEncode(0, top), [0])
        },
    },
    set: {
        // Adjacent symbols coalesce into one run, in either order given.
        adjacent: () => {
            assertStructurallySame(set('ab'), [c('a'), c('b') + 1])
            assertStructurallySame(set('ba'), [c('a'), c('b') + 1])
        },
        // A gap stays a gap: two runs, not one.
        gap: () => {
            assertStructurallySame(
                set('ac'),
                [c('a'), c('a') + 1, c('c'), c('c') + 1])
        },
        // A repeated symbol is the same set as one of it.
        duplicate: () => {
            assertStructurallySame(set('aa'), set('a'))
        },
        // No symbols is the empty set, which is a value rather than a mistake.
        // It is not a terminal, which is `oneOf`'s business below.
        empty: () => {
            assertStructurallySame(set(''), [])
        },
    },
    // The set algebra is `types/range_set`'s, over values, and there is no
    // second copy of it here. These two are what the grammars below reach for.
    algebra: {
        union: () => {
            assertStructurallySame(
                union(range('09'))(range('af')),
                [c('0'), c('9') + 1, c('a'), c('f') + 1])
            assertStructurallySame(
                union(range('09'))(range('5A')),
                [c('0'), c('A') + 1])
        },
        // The motivating case: every symbol from a space up, minus the two a
        // JSON string cannot carry raw.
        difference: () => {
            assertStructurallySame(
                difference(range(' ~'))(set('"\\')),
                [c(' '), c('"'), c('"') + 1, c('\\'), c('\\') + 1, c('~') + 1])
        },
    },
    oneOf: {
        // The one injection from a value to a rule: the boundaries, behind the
        // `'set'` tag and a thunk.
        rule: () => {
            assertStructurallySame(oneOf(range('09'))(), ['set', c('0'), c('9') + 1])
            assertStructurallySame(boundaries(oneOf(set('ac'))), set('ac'))
        },
        // An open tail is a terminal like any other — it is how the top symbol
        // is spelled at all.
        openTail: () => {
            const top = Number.MAX_SAFE_INTEGER
            assertStructurallySame(boundaries(oneOf(rangeEncode(top, top))), [top])
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
            const inner = oneOf(range('09'))
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
        // Ordinary symbols are the non-negative safe integers. Above the top
        // the successor is the number itself, and `Infinity` is not in the
        // universe at all; below zero is EOF's place, not a set's.
        rangeEncodeRejectsInfinity: () => rangeEncode(Infinity, Infinity),
        rangeEncodeRejectsUnsafe: () => rangeEncode(0, Number.MAX_VALUE),
        rangeEncodeRejectsFraction: () => rangeEncode(0.5, 1.5),
        rangeEncodeRejectsNaN: () => rangeEncode(NaN, NaN),
        rangeEncodeRejectsNegative: () => rangeEncode(-2, -1),
        rangeEncodeRejectsEof: () => rangeEncode(-1, 0),
        // `-0` is a second spelling of `0`, so it is no boundary.
        rangeEncodeRejectsNegativeZero: () => rangeEncode(-0, 1),
        // A set that can never match is a grammar error, not a rule.
        oneOfRejectsEmpty: () => oneOf(set('')),
        // A set holds ordinary symbols only: EOF is a rule of its own, and a
        // generic complement opens at a bottom no symbol reaches.
        oneOfRejectsEof: () => oneOf([-1, 0]),
        oneOfRejectsUnbounded: () => oneOf([-Infinity]),
        // The boundary above the top symbol is not one an adapter can deliver.
        oneOfRejectsUnsafe: () => oneOf([0, 2 ** 53]),
        // A list that is not a set at all — a repeat is not strictly increasing.
        oneOfRejectsNonSet: () => oneOf([1, 1]),
        // A repetition bound is a count: `Infinity` is one only above.
        repeatRejectsNegativeMin: () => repeat(-1, 5),
        repeatRejectsFractionalMin: () => repeat(0.5, 5),
        repeatRejectsNegativeMax: () => repeat(0, -1),
        repeatRejectsFractionalMax: () => repeat(0, 1.5),
        repeatRejectsInfiniteMin: () => repeat(Infinity, Infinity),
        repeatRejectsReversed: () => repeat(2, 1),
    },
}
