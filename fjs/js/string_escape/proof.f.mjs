import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import {
    backspace,
    cr,
    ff,
    ht,
    latinSmallLetterB,
    latinSmallLetterF,
    latinSmallLetterN,
    latinSmallLetterR,
    latinSmallLetterT,
    latinSmallLetterU,
    lf,
    quotationMark,
    reverseSolidus,
    solidus,
} from '../../text/ascii/module.f.mjs'
import {
    codePointToEscape,
    escapeToCodePoint,
    optionalEscape,
    simpleEscapes,
} from './module.f.mjs'

/**
 * The escapes spelled out independently of the table, so the proof compares
 * two statements of the set rather than the table against itself.
 *
 * @type {readonly (readonly [number, number])[]}
 */
const expected = [
    [quotationMark, quotationMark],
    [reverseSolidus, reverseSolidus],
    [solidus, solidus],
    [latinSmallLetterB, backspace],
    [latinSmallLetterF, ff],
    [latinSmallLetterN, lf],
    [latinSmallLetterR, cr],
    [latinSmallLetterT, ht],
]

export const proof = {
    simpleEscapes: () => assertStructurallySame(simpleEscapes, expected),
    // Every letter decodes to its code point, and — apart from the optional
    // one — every code point encodes back to its letter. Round-tripping both
    // ways is what the two derived views are for.
    roundTrip: () => expected.forEach(([letter, codePoint]) => {
        assertEq(escapeToCodePoint(letter), codePoint, letter)
        assertEq(codePointToEscape(codePoint), codePoint === optionalEscape ? null : letter, codePoint)
    }),
    // `\/` is accepted and never produced: the one asymmetry between the views.
    optionalEscape: [
        () => assertEq(escapeToCodePoint(optionalEscape), solidus),
        () => assertEq(codePointToEscape(optionalEscape), null),
    ],
    // `u` is a letter the grammar accepts after a backslash, but its meaning
    // comes from the digits that follow, so it is deliberately absent here.
    unicodeEscapeIsNotSimple: () => assertEq(escapeToCodePoint(latinSmallLetterU), null),
    // A code point with no simple escape, from either side.
    noEscape: [
        () => assertEq(escapeToCodePoint(0x61), null), // `a`
        () => assertEq(codePointToEscape(0x61), null),
        () => assertEq(codePointToEscape(0x00), null), // NUL: a control, but no short form
    ],
    // The letters are distinct — a repeated letter would silently shadow an
    // entry in the decode view, and the table is small enough to say so.
    lettersAreDistinct: () => assertEq(new Set(simpleEscapes.map(([letter]) => letter)).size, simpleEscapes.length),
}
