/**
 * The simple string escapes — one source of truth.
 *
 * `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`: every escape sequence whose
 * meaning is one fixed code point. `\uXXXX` is not one of them — its meaning
 * is computed from the digits that follow rather than looked up — and neither
 * are JavaScript's `\0`, `\v`, `\xXX`, or a line continuation, which
 * FunctionalScript does not accept.
 *
 * The set is the same for a JavaScript string literal and for JSON's `char`
 * production, so the JSON serializer and both tokenizers derive their view
 * from this one list rather than keeping a copy each: an encode side and two
 * decode sides that cannot drift apart.
 *
 * @module
 */

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
    lf,
    quotationMark,
    reverseSolidus,
    solidus,
} from '../../text/ascii/module.f.mjs'

/**
 * The escape letter paired with the code point it denotes.
 *
 * The first three denote themselves — `\"` is `"` — and are escapable because
 * an unescaped `"` would end the literal and an unescaped `\` would start
 * another escape. The rest name C0 controls, which have no printable form of
 * their own.
 *
 * @type {readonly (readonly [letter: number, codePoint: number])[]}
 */
export const simpleEscapes = [
    [quotationMark, quotationMark],
    [reverseSolidus, reverseSolidus],
    [solidus, solidus],
    [latinSmallLetterB, backspace],
    [latinSmallLetterF, ff],
    [latinSmallLetterN, lf],
    [latinSmallLetterR, cr],
    [latinSmallLetterT, ht],
]

/**
 * The one escape that is optional. `/` is a legal string character on its own,
 * so `\/` has to be *accepted* while nothing has to *produce* it — which is
 * why the decode view below covers one more entry than the encode view.
 */
export const optionalEscape = solidus

/**
 * A code-point-keyed view over the pairs.
 *
 * A `Map` rather than a plain object, for two reasons. The JSON serializer
 * takes this path once per character it writes, and a `Map` keyed by number
 * never converts the key to a string. And an object's keys are not only its
 * own: a numeric property on `Object.prototype` — which this repository would
 * never write, but a host page can — would read back as a table entry and
 * silently mis-escape a character. A `Map` has no prototype chain to inherit
 * one from, so the lookup answers for the table and nothing else.
 *
 * @type {(pairs: readonly (readonly [number, number])[]) => (key: number) => number | null}
 */
const lookup = pairs => {
    const map = new Map(pairs)
    return key => map.get(key) ?? null
}

/**
 * The decode view: the code point an escape letter denotes, or `null` when the
 * letter is not a simple escape — `u`, or a character the grammar rejects.
 *
 * @type {(letter: number) => number | null}
 */
export const escapeToCodePoint = lookup(simpleEscapes)

/**
 * The encode view: the escape letter denoting a code point, or `null` when the
 * code point has no simple escape or needs none (see {@link optionalEscape}).
 *
 * @type {(codePoint: number) => number | null}
 */
export const codePointToEscape = lookup(simpleEscapes.flatMap(([letter, codePoint]) =>
    codePoint === optionalEscape ? [] : [/** @type {const} */([codePoint, letter])]))
