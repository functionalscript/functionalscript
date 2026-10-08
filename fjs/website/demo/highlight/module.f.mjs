/**
 * Syntax highlighting for the code a demo prints: a text as HTML nodes, the
 * words, literals and comments of a JavaScript-family text wrapped in a
 * `span` marked `data-token`, everything else left as plain text.
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
 * @import { JsToken, JsTokenWithMetadata } from '../../../ebnf/lib/js/types.ts'
 */

import { tokenize } from '../../../js/tokenizer/module.f.mjs'
import { isKeyword } from '../../../js/keywords/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'

/**
 * The class of a token, or `undefined` for one that stays plain.
 *
 * @type {(token: JsToken) => string | undefined}
 */
const classOf = ({ kind }) => {
    switch (kind) {
        case 'true': case 'false': case 'null': case 'undefined': return 'literal'
        case 'string': return 'string'
        case 'number': case 'bigint': return 'number'
        case '//': case '/*': return 'comment'
        default: return isKeyword(kind) ? 'keyword' : undefined
    }
}

/**
 * A span of text, wrapped when its token has a class. Trailing whitespace is
 * not the token's: the tokenizer anchors a run of trivia that holds a
 * newline at the newline, so the blanks before it fall in the previous
 * token's cut.
 *
 * @type {(token: JsToken, text: string) => readonly Node[]}
 */
const piece = (token, text) => {
    const c = classOf(token)
    if (c === undefined) { return [text] }
    const body = text.trimEnd()
    return [['span', { 'data-token': c }, body], text.slice(body.length)]
}

/**
 * `text` as nodes: plain strings and classed spans whose text, joined, is
 * `text`.
 *
 * @type {(text: string) => readonly Node[]}
 */
export const highlight = text => {
    const tokens = toArray(tokenize(stringToList(text))(''))
    if (tokens.some(({ token }) => token.kind === 'error')) { return [text] }
    const symbols = Array.from(text)
    const lineStarts = symbols.reduce(
        (starts, s, i) => s === '\n' ? [...starts, i + 1] : starts,
        /** @type {readonly number[]} */([0]))
    /** @type {(t: JsTokenWithMetadata) => number} */
    const offset = ({ metadata: { line, column } }) => lineStarts[line - 1] + column - 1
    // A token that starts where the previous one does adds nothing to cut:
    // the `nl` a block comment with a newline is followed by.
    const starts = tokens.map(offset)
    const kept = tokens.flatMap((t, i) => i > 0 && starts[i] === starts[i - 1] ? [] : [[t.token, starts[i]]])
    return kept
        .flatMap(([token, start], i) => piece(
            /** @type {JsToken} */(token),
            symbols.slice(/** @type {number} */(start), i + 1 < kept.length ? /** @type {number} */(kept[i + 1][1]) : symbols.length).join('')))
        .filter(node => node !== '')
}
