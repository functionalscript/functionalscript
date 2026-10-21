/**
 * The words of generated Rust that its printer should have marked and did
 * not: a check, since a mark that goes missing changes no text. `untagged`
 * strips a tag and leaves the text exactly as it was, and the colours are the
 * only thing a missing mark changes, so no proof of the text sees it. This
 * reads the plain runs of marked Rust and answers the words in them that
 * belong to a kind the printer marks — a keyword, `true` or `false`, and a
 * number — so a proof can require there be none.
 *
 * It is a completeness check beside the allowed-list check (every marked run
 * is one of the forms the printer says it marks), and what it finds is exact
 * for Rust as the printer writes it: strings are marked whole, so a plain run
 * holds no string's content, and the words of the language are the only
 * identifiers that spell these.
 *
 * @module
 *
 * @import { Marked } from '../../../text/marked/types.ts'
 */

import { charIs, isDigit, isLatinLetter, lowLine } from '../../../text/ascii/module.f.js'

/** The words the printer marks as keywords or literals. @type {readonly string[]} */
const marked = ['let', 'pub', 'fn', 'use', 'true', 'false']

/** @type {(c: string) => boolean} */
const isDigitChar = charIs(isDigit)

/** A letter, a digit or `_`, over `text/ascii`'s classes. @type {(c: string) => boolean} */
const isWordChar = charIs(c => isDigit(c) || isLatinLetter(c) || c === lowLine)

/**
 * The words of a text: maximal runs of letters, digits and `_`.
 *
 * @type {(text: string) => readonly string[]}
 */
export const wordsOf = text => [...text].reduce(
    (words, c) => isWordChar(c)
        ? (words.length > 0 && words[Number(words.length - 1)] !== '' ? [...words.slice(0, -1), words[Number(words.length - 1)] + c] : [...words.slice(0, -1), c])
        : [...words, ''],
    /** @type {readonly string[]} */([''])).filter(word => word !== '')

/**
 * The words in the plain runs of `text` that the printer marks when it
 * spells them: none, where it marked everything it should have.
 *
 * @type {(text: Marked) => readonly string[]}
 */
export const unmarkedWords = text =>
    text.flatMap(part => {
        const run = part[0]
        const kind = part[1]
        return kind === undefined ? wordsOf(run).filter(word => marked.includes(word) || isDigitChar(word[0])) : []
    })
