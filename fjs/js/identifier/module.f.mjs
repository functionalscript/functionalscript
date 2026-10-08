/**
 * JavaScript's lexical rules for a word — one source of truth.
 *
 * The characters are classified by code point through
 * [`text/ascii`](../../text/ascii/module.f.mjs), which owns the classes; this
 * module adds only what JavaScript adds to them: `_` and `$` as identifier
 * characters. A case fold would not do: `'K'`, the Kelvin sign,
 * lowercases to `k` and is no letter the tokenizer takes.
 *
 * @module
 */

import { dollarSign, isCanonicalDigits, isDigit, isLatinLetter, lowLine } from '../../text/ascii/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/** @type {(s: string) => readonly number[]} */
const codePoints = s => toArray(stringToCodePointList(s))

/** What may open an identifier: a Latin letter, `_` or `$`. @type {(codePoint: number) => boolean} */
const isIdentifierStart = codePoint =>
    isLatinLetter(codePoint) || codePoint === lowLine || codePoint === dollarSign

/**
 * Whether a word is one the tokenizer reads as a single `id` token —
 * `[A-Za-z_$][A-Za-z0-9_$]*`. A keyword is such a word too: whether it may
 * be bound is [`js/keywords`](../keywords/module.f.mjs)' question.
 *
 * @type {(s: string) => boolean}
 */
export const isIdentifier = s => {
    const word = codePoints(s)
    return word.length !== 0
        && isIdentifierStart(word[0])
        && word.every(c => isIdentifierStart(c) || isDigit(c))
}

/**
 * Whether a word is a non-negative decimal integer without a leading zero —
 * `text/ascii`'s `isCanonicalDigits` over the word's code points.
 *
 * @type {(s: string) => boolean}
 */
export const isInteger = s => isCanonicalDigits(codePoints(s))
