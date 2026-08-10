/**
 * JSON serializer for deterministic string output.
 *
 * `stringSerialize` is FunctionalScript, not the host's `JSON.stringify`: it
 * escapes over this repository's own UTF-16 decoder and reproduces the
 * ECMAScript `QuoteJSONString` result exactly, lone surrogates included.
 *
 * @module
 */
import { flat, map, reduce, empty, type List } from '../../../types/list/module.f.mjs'
import { type Reduce } from '../../../types/function/operator/module.f.mjs'
import { concat } from '../../../types/string/module.f.ts'
import {
    codePointToString,
    stringToCodePointList,
    type CodePoint,
} from '../../../text/utf16/module.f.mjs'
import { errorMask } from '../../../text/code_point/module.f.mjs'
import {
    backspace,
    cr,
    digit0,
    ff,
    ht,
    latinSmallLetterA,
    lf,
    quotationMark,
    reverseSolidus,
    space,
} from '../../../text/ascii/module.f.mjs'

const jsonStringify = JSON.stringify

const { fromCharCode } = String

/**
 * The code points JSON gives a two-character escape. Every other code point
 * below `space` has no short form and goes through `unicodeEscape` instead.
 */
const escapeTable = {
    [backspace]: '\\b',
    [ht]: '\\t',
    [lf]: '\\n',
    [ff]: '\\f',
    [cr]: '\\r',
    [quotationMark]: '\\"',
    [reverseSolidus]: '\\\\',
} as const

const hexDigit = (value: number): string =>
    fromCharCode(value < 10 ? digit0 + value : latinSmallLetterA + value - 10)

/**
 * `\uXXXX` with lowercase hex digits, matching ECMAScript's `UnicodeEscape`.
 */
const unicodeEscape = (unit: number): string =>
    `\\u${hexDigit(unit >> 12 & 0xf)}${hexDigit(unit >> 8 & 0xf)}${hexDigit(unit >> 4 & 0xf)}${hexDigit(unit & 0xf)}`

/**
 * Escapes one decoded code point. A code point tagged with `errorMask` is an
 * unpaired surrogate, which well-formed JSON stringification (ES2019) emits as
 * its `\uXXXX` escape rather than as a code unit; everything else is either a
 * named escape, a `\u00XX` control escape, or the character itself.
 */
const escapeCodePoint = (codePoint: CodePoint): string =>
    (codePoint & errorMask) !== 0
        ? unicodeEscape(codePoint & 0xffff)
        : escapeTable[codePoint]
            ?? (codePoint < space ? unicodeEscape(codePoint) : codePointToString(codePoint))

/**
 * Serializes a string as a JSON string literal.
 */
export const stringSerialize
    : (_: string) => List<string>
    = input => [`"${concat(map(escapeCodePoint)(stringToCodePointList(input)))}"`]

/**
 * Serializes a number as a JSON number literal.
 */
export const numberSerialize
    : (_: number) => List<string>
    = input => [jsonStringify(input)]

/**
 * Shared serialized representation for `null`.
 */
export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

export const boolSerialize
    : (_: boolean) => List<string>
    = value => value ? trueSerialize : falseSerialize

const comma = [',']

const joinOp
    : Reduce<List<string>>
    = b => prior => flat([prior, comma, b])

const join
    : (input: List<List<string>>) => List<string>
    = reduce(joinOp)(empty)

const wrap
    : (open: string) => (close: string) => (input: List<List<string>>) => List<string>
    = open => close => {
        const seqOpen = [open]
        const seqClose = [close]
        return input => flat([seqOpen, join(input), seqClose])
    }

export const objectWrap
    : (input: List<List<string>>) => List<string>
    = wrap('{')('}')

/**
 * Wraps serialized entries into a JSON array.
 */
export const arrayWrap
    : (input: List<List<string>>) => List<string>
    = wrap('[')(']')
