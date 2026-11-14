/**
 * The string escapes — one source of truth — and the one writer of a quoted
 * string built on them.
 *
 * `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`: JSON's simple escapes,
 * whose meaning is one fixed code point. `\uXXXX` is not one of them — its
 * meaning is computed from the digits that follow rather than looked up.
 *
 * The set is JSON's `char` production's, so everything that reads or writes
 * one derives its view from this one list rather than keeping a copy: the
 * JSON grammar (`../../ebnf/lib/json`) admits its letters, the JSON reader
 * and the JavaScript tokenizer decode through it, and {@link stringLiteral}
 * encodes through it, so none of them can drift apart. A
 * single-quoted string adds `\'`, `\v` and `\xHH`, which are not JSON's,
 * so the JavaScript tokenizer decodes them above this table: rows here would
 * make the encode view write non-JSON escapes into JSON. `\0` and line
 * continuations remain outside FunctionalScript's string subset.
 *
 * `stringLiteral` writes a string as a double-quoted literal, which is JSON
 * and JavaScript alike. Every writer of a quoted string in source text — the
 * JSON serializer among them — goes through it rather than through the
 * host's `JSON.stringify`.
 *
 * @module
 *
 * @import { CodePoint } from '../../text/code_point/types.ts'
 */

import { map } from '../../types/list/module.f.js'
import { concat } from '../../types/string/module.f.js'
import { map as nullableMap } from '../../types/nullable/module.f.js'
import { codePointToString, stringToCodePointList } from '../../text/utf16/module.f.js'
import { errorMask } from '../../text/code_point/module.f.js'
import { encodeScalar } from '../../basen/base16/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
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
    space,
} from '../../text/ascii/module.f.js'

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
 * The pairs become enumerable own entries. `entry` reads only those, so
 * inherited numeric properties never become escapes.
 *
 * @type {(pairs: readonly (readonly [number, number])[]) => (key: number) => number | null}
 */
const lookup = pairs => {
    const table = Object.fromEntries(pairs)
    return key => entry(table, key) ?? null
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

/** A UTF-16 code unit as four hexadecimal digits. */
const hexUnit = encodeScalar(4)

/**
 * `\uXXXX` with lowercase hex digits, matching ECMAScript's `UnicodeEscape`.
 *
 * @type {(unit: number) => string}
 */
const unicodeEscape = unit =>
    `\\u${hexUnit(unit)}`

/**
 * The two-character escape a letter spells, projected over the lookup's
 * `null`. Bound here rather than inside `escapeCodePoint`: it depends on
 * nothing that varies per code point, and `escapeCodePoint` runs once per
 * character of every string written.
 *
 * @type {(letter: number | null) => string | null}
 */
const simpleEscape = nullableMap(letter => `\\${codePointToString(letter)}`)

/**
 * Escapes one decoded code point. A code point tagged with `errorMask` is an
 * unpaired surrogate, which well-formed JSON stringification (ES2019) emits as
 * its `\uXXXX` escape rather than as a code unit; everything else is either a
 * simple escape, a `\u00XX` control escape, or the character itself.
 *
 * @type {(codePoint: CodePoint) => string}
 */
const escapeCodePoint = codePoint =>
    (codePoint & errorMask) !== 0
        ? unicodeEscape(codePoint & 0xffff)
        : simpleEscape(codePointToEscape(codePoint))
            ?? (codePoint < space ? unicodeEscape(codePoint) : codePointToString(codePoint))

/**
 * A string as a double-quoted literal: the ECMAScript `QuoteJSONString`
 * result, reproduced exactly, lone surrogates included, over this
 * repository's own UTF-16 decoder rather than the host's `JSON.stringify`.
 *
 * The text is a JSON string, and a JavaScript string literal with the same
 * value.
 *
 * @type {(input: string) => string}
 */
export const stringLiteral = input =>
    `"${concat(map(escapeCodePoint)(stringToCodePointList(input)))}"`
