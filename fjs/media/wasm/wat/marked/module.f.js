/**
 * WebAssembly text (WAT) as marked runs, found by tokenizing: the fallback
 * for WAT no producer marked, such as the text a WASM demo page fetches,
 * which carries [`wat`](../module.f.mjs)'s words but none of its marks. What
 * marked text is, and why: [`fjs/text/marked`](../../../../text/marked/README.md).
 *
 * **It reads the tokens of the text format's lexical grammar**, as
 * `wasmprinter` writes them and [`wat`](../module.f.mjs) after it:
 *
 * - a word of `idchar`s, its kind by its first character: `$` an
 *   `identifier`, `$"…"` included; a digit, with a sign or not, or `inf`
 *   and `nan`, a `number`; a lower-case letter, as `module`, `i32.add` and
 *   `offset=8`, or `@`, an annotation such as `@name`, a `keyword`; any other
 *   word stays plain;
 * - a `"…"` string, its escapes inside it;
 * - a `;;` comment to the end of its line, and a `(; … ;)` comment, which
 *   nests;
 * - parentheses and blanks, which stay plain.
 *
 * **A text it cannot read has no spans.** An unclosed string or comment, a
 * line break inside a string, or a character no token holds — a comma, a
 * bracket, a letter outside ASCII outside a string or comment — makes the
 * whole text plain: colouring the tokens before the failure would suggest
 * the text is partly valid.
 *
 * Offsets count code points, as a {@link Span}'s do.
 *
 * @module
 *
 * @import { Span, TokenKind } from '../../../../text/marked/types.ts'
 */

/** The punctuation a word holds, beside ASCII letters and digits. */
const punctuation = '!#$%&\'*+-./:<=>?@\\^_`|~'

/** Whether a character is a digit. @type {(c: string | undefined) => boolean} */
const isDigit = c => c !== undefined && c >= '0' && c <= '9'

/** Whether a character is a lower-case ASCII letter. @type {(c: string | undefined) => boolean} */
const isLower = c => c !== undefined && c >= 'a' && c <= 'z'

/**
 * Whether a character belongs to a word: the text format's `idchar`.
 *
 * @type {(c: string | undefined) => boolean}
 */
const isWordChar = c => c !== undefined
    && (isDigit(c) || isLower(c) || (c >= 'A' && c <= 'Z') || punctuation.includes(c))

/**
 * The kind of a word, or `undefined` for one that stays plain.
 *
 * @type {(word: string) => TokenKind | undefined}
 */
const wordKind = word => {
    const first = word[0]
    if (first === '$') { return 'identifier' }
    const unsigned = first === '+' || first === '-' ? word.slice(1) : word
    if (isDigit(unsigned[0]) || unsigned === 'inf' || unsigned === 'nan' || unsigned.startsWith('nan:')) { return 'number' }
    return isLower(first) || first === '@' ? 'keyword' : undefined
}

/**
 * The index after a string that opens with the quote at `at`, or `-1` where
 * it is not closed on its line. A backslash escapes the character after it,
 * a quote included.
 *
 * @type {(cs: readonly string[], at: number) => number}
 */
const stringEnd = (cs, at) => {
    let i = at + 1
    while (i < cs.length) {
        const c = cs[Number(i)]
        if (c === '"') { return i + 1 }
        if (c === '\n') { return -1 }
        i = i + (c === '\\' ? 2 : 1)
    }
    return -1
}

/**
 * The index after a block comment that opens at `at`, or `-1` where it is
 * not closed. One `(;` inside another nests, and each needs its own `;)`.
 *
 * @type {(cs: readonly string[], at: number) => number}
 */
const blockCommentEnd = (cs, at) => {
    let depth = 0
    let i = at
    while (i < cs.length) {
        const c = cs[Number(i)]
        const next = cs[Number(i + 1)]
        if (c === '(' && next === ';') {
            depth = depth + 1
            i = i + 2
            continue
        }
        if (c === ';' && next === ')') {
            depth = depth - 1
            i = i + 2
            if (depth === 0) { return i }
            continue
        }
        i = i + 1
    }
    return -1
}

/**
 * The spans the tokens of WAT `text` are, in order, or none where the text
 * does not tokenize.
 *
 * @type {(text: string) => readonly Span[]}
 */
export const spansOf = text => {
    const cs = [...text]
    /** @type {readonly Span[]} */
    let out = []
    let i = 0
    while (i < cs.length) {
        const c = cs[Number(i)]
        const next = cs[Number(i + 1)]
        const start = i
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ')' || (c === '(' && next !== ';')) {
            i = i + 1
            continue
        }
        if (c === ';' && next === ';') {
            while (i < cs.length && cs[Number(i)] !== '\n' && cs[Number(i)] !== '\r') { i = i + 1 }
            out = [...out, { start, length: i - start, kind: 'comment' }]
            continue
        }
        if (c === '(') {
            i = blockCommentEnd(cs, start)
            if (i === -1) { return [] }
            out = [...out, { start, length: i - start, kind: 'comment' }]
            continue
        }
        if (c === '"') {
            i = stringEnd(cs, start)
            if (i === -1) { return [] }
            out = [...out, { start, length: i - start, kind: 'string' }]
            continue
        }
        if (!isWordChar(c)) { return [] }
        while (isWordChar(cs[Number(i)])) { i = i + 1 }
        // `$"…"` is one identifier: a `$` and the string that names it.
        if (c === '$' && i === start + 1 && cs[Number(i)] === '"') {
            i = stringEnd(cs, i)
            if (i === -1) { return [] }
            out = [...out, { start, length: i - start, kind: 'identifier' }]
            continue
        }
        const kind = wordKind(cs.slice(start, i).join(''))
        out = kind === undefined ? out : [...out, { start, length: i - start, kind }]
    }
    return out
}
