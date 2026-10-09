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
 * @import { Marked, Span, TokenKind } from '../../../text/marked/types.ts'
 */

import { tokenize } from '../../../js/tokenizer/module.f.mjs'
import { isKeyword } from '../../../js/keywords/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { fromSpans } from '../../../text/marked/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
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
        case 'true': case 'false': case 'null': case 'undefined': return 'literal'
        case 'string': return 'string'
        case 'number': case 'bigint': return 'number'
        case '//': case '/*': return 'comment'
        default: return isKeyword(kind) ? 'keyword' : undefined
    }
}

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
 * @type {(text: string) => readonly Span[]}
 */
export const spansOf = text => {
    const tokens = toArray(tokenize(stringToList(text))(''))
    if (tokens.some(({ token }) => token.kind === 'error')) { return [] }
    const symbols = Array.from(text)
    const lineStarts = symbols.reduce(
        (starts, s, i) => s === '\n' ? [...starts, i + 1] : starts,
        /** @type {readonly number[]} */([0]))
    const starts = tokens.map(({ metadata: { line, column } }) => lineStarts[line - 1] + column - 1)
    // A token that starts where the previous one does adds nothing to cut:
    // the `nl` a block comment with a newline is followed by.
    const kept = tokens.flatMap(({ token }, i) => i > 0 && starts[i] === starts[i - 1] ? [] : [{ token, start: starts[i] }])
    return kept.flatMap(({ token, start }, i) => {
        const kind = kindOf(token)
        if (kind === undefined) { return [] }
        const end = i + 1 < kept.length ? kept[i + 1].start : symbols.length
        return [{ start, length: Array.from(symbols.slice(start, end).join('').trimEnd()).length, kind }]
    })
}

/**
 * `text` as nodes, by tokenizing it: plain strings and classed spans whose
 * text, joined, is `text`.
 *
 * @type {(text: string) => readonly Node[]}
 */
export const highlight = text => render(unwrap(fromSpans(text)(spansOf(text))))
