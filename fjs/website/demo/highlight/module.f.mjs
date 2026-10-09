/**
 * Syntax highlighting for the code a demo prints: marked text as HTML nodes,
 * each run with a kind wrapped in a `span` marked `data-token`, every other
 * run left as plain text. {@link render} draws runs a producer supplied;
 * {@link highlight} is the fallback for a text with no producer behind it,
 * which finds the runs by tokenizing.
 *
 * Design: `website/demo/todo/highlight-from-producers.md`, proposed in
 * https://github.com/functionalscript/functionalscript/pull/2697.
 *
 * **It reads the text with the real tokenizer**, [`fjs/js/tokenizer`](../../../js/tokenizer/module.f.mjs),
 * not with a lookalike, so a string that holds `//` is a string and a
 * keyword is whatever [`isKeyword`](../../../js/keywords/module.f.mjs) says.
 * The tokenizer keeps a token's value, not its spelling (`'a'` and `"a"` are
 * one string), so each token's text is cut from the input between its start
 * and the next token's.
 *
 * **Highlighting never changes the text.** The nodes' text, concatenated, is
 * the input exactly, so a copy button next to the block copies what the
 * reader sees.
 *
 * **A text the tokenizer refuses is returned plain.** Colouring the tokens
 * before the failure and not after would suggest the text is partly valid;
 * it is the demo's caption and refusal that say what is wrong, not the
 * colours.
 *
 * Classes, the values of `data-token`: `keyword`, `literal` (`true`,
 * `false`, `null`, `undefined`), `string`, `number` (a bigint included) and
 * `comment`. Names and punctuation stay plain. The stylesheet owns the
 * colours.
 *
 * @module
 *
 * @import { Node } from '../../../media/html/types.ts'
 * @import { JsToken } from '../../../ebnf/lib/js/types.ts'
 * @import { StateScan } from '../../../types/function/operator/types.ts'
 * @import { Marked, Span, TokenKind } from '../../../text/marked/types.ts'
 */

import { _positions, tokenize } from '../../../js/tokenizer/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { isKeyword, literalWords } from '../../../js/keywords/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { fromSpans, toText } from '../../../text/marked/module.f.mjs'
import { stateScan, toArray } from '../../../types/list/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'

/**
 * Marked text as nodes: a run with a kind as a classed `span`, a run
 * without one as its bare string, an empty run as nothing.
 *
 * @type {(marked: Marked) => readonly Node[]}
 */
export const render = marked => marked.flatMap(([text, kind]) =>
    text === '' ? [] : [kind === undefined ? text : ['span', { 'data-token': kind }, text]])

/**
 * The kind of a token, or `undefined` for one that stays plain.
 *
 * @type {(token: JsToken) => TokenKind | undefined}
 */
const kindOf = ({ kind }) => {
    switch (kind) {
        case 'string': return 'string'
        case 'number': case 'bigint': return 'number'
        case '//': case '/*': return 'comment'
        default: return literalWords.includes(/** @type {never} */ (kind)) ? 'literal' : isKeyword(kind) ? 'keyword' : undefined
    }
}

/** Whether a token is no part of the program's words: whitespace, a newline or a comment. @type {(token: JsToken) => boolean} */
const isTrivia = ({ kind }) => kind === 'ws' || kind === 'nl' || kind === '//' || kind === '/*'

/**
 * The spans the tokenizer finds in `text`: none if it refuses the text, as
 * colouring the tokens before a failure would suggest the text is partly
 * valid.
 *
 * The tokenizer keeps a token's value, not its spelling (`'a'` and `"a"` are
 * one string), so a token's text is cut from the input between its start and
 * the next token's, less trailing blanks: it anchors a run of trivia that
 * holds a newline at the newline, so the blanks before it fall in the
 * previous token's cut.
 *
 * **A word after `.` or `?.` is a property name**, `x.true` and `x.default`,
 * and stays plain: the tokenizer reads it as the word it spells, which the
 * language does not mean there.
 *
 * @type {(text: string) => readonly Span[]}
 */
export const spansOf = text => {
    // code points, not UTF-16 units, so that an offset counts what `Span` does
    const input = toArray(stringToCodePointList(text))
    const tokens = toArray(tokenize(input)(''))
    if (tokens.some(({ token }) => token.kind === 'error')) { return [] }
    const symbols = Array.from(text)
    // Where a position is, by the fold that positioned the tokens, so the
    // lines are counted as the tokenizer counts them. The LF of a CRLF takes
    // the position of the character after it, which is the one a token
    // starts at, so the later index wins.
    const indexOf = new Map(_positions('')(input).map(({ line, column }, i) => [`${line}:${column}`, i]))
    const starts = tokens.map(({ metadata: { line, column } }) => assertNotNullish(indexOf.get(`${line}:${column}`), 'a token at no position'))
    // A token that starts where the previous one does adds nothing to cut:
    // the `nl` a block comment with a newline is followed by.
    const kept = tokens.flatMap(({ token }, i) => i > 0 && starts[i] === starts[i - 1] ? [] : [{ token, start: starts[i] }])
    // The kind of the word before each token, trivia skipped, in one pass.
    /** @type {StateScan<{ token: JsToken }, string, string>} */
    const word = ({ token }, prior) => [prior, isTrivia(token) ? prior : token.kind]
    const afterWords = toArray(stateScan(word)('')(kept))
    // The last token is `eof`, which stays plain, so every token that has a
    // kind has a next one to end at.
    return kept.slice(0, -1).flatMap(({ token, start }, i) => {
        const kind = kindOf(token)
        const before = afterWords[i]
        return kind === undefined || ((kind === 'keyword' || kind === 'literal') && (before === '.' || before === '?.')) ? [] : [{ start, length: Array.from(symbols.slice(start, kept[i + 1].start).join('').trimEnd()).length, kind }]
    })
}

/**
 * Where a producer's markup and the tokenizer part ways, or `null` where
 * they agree: the marked runs, as spans of the whole text, are the spans
 * the tokenizer finds in it, one for one. The tokenizer reads `-0` as a
 * prefix and a number, so a leading `-` is not part of the span it finds.
 * What a producer marks, this holds it to; the proofs of the producers that
 * mark ask it of every example they have.
 *
 * @type {(marked: Marked) => string | null}
 */
export const disagreement = marked => {
    const text = toText(marked)
    const found = JSON.stringify(spansOf(text))
    /** @type {readonly Span[]} */
    const given = marked.reduce(
        (acc, [chunk, kind]) => {
            const length = Array.from(chunk).length
            const dash = kind !== undefined && chunk.startsWith('-') ? 1 : 0
            return {
                at: acc.at + length,
                spans: kind === undefined ? acc.spans : [...acc.spans, { start: acc.at + dash, length: length - dash, kind }],
            }
        },
        /** @type {{ at: number, spans: readonly Span[] }} */({ at: 0, spans: [] })).spans
    const marks = JSON.stringify(given)
    return marks === found ? null : `marked ${marks}, the tokenizer finds ${found}, in ${text}`
}

/**
 * `text` as nodes, by tokenizing it: plain strings and classed spans whose
 * text, joined, is `text`.
 *
 * @type {(text: string) => readonly Node[]}
 */
export const highlight = text => render(unwrap(fromSpans(text)(spansOf(text))))
