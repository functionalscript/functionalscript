/**
 * JavaScript text as the tokens this tokenizer reads from it, trivia
 * included: type any JavaScript, read one line per token.
 *
 * **This is the shared stream, before the compiler folds it.** The
 * [compiler tokenizer's page](../../compiler/tokenizer/demo.f.mjs) shows the
 * tokens the parser reads, with whitespace and comments gone; this one shows
 * them as every reader of JavaScript text receives them, `ws`, `nl` and
 * comments included, so the two pages together show what the compiler's fold
 * removes.
 *
 * **An error is the whole stream.** A lexical failure answers one `error`
 * token and nothing else, so typing `123abc` replaces the listing with
 * `invalid number`.
 *
 * **It needs no operations.** Tokenizing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { JsTokenWithMetadata } from '../../ebnf/lib/js/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { codeMarker } from '../../website/style/module.f.js'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { caption, textDemo } from '../../website/demo/module.f.mjs'
import { highlight } from '../../website/demo/highlight/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { stringLiteral } from '../string_escape/module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'

/**
 * A value as the repository's string literal, with U+2028 and U+2029 escaped
 * too: `stringLiteral` writes them as they are, and either would break a
 * token's line in two.
 *
 * @type {(value: string) => string}
 */
const show = value => stringLiteral(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')

/**
 * One token as a line: `line:column  kind  value`, with an error's message in
 * place of a value. A comment shows its text; a run of whitespace is one
 * `ws` or `nl` line, however long it is.
 *
 * @type {(t: JsTokenWithMetadata) => string}
 */
export const line = ({ token, metadata }) => {
    const detail = token.kind === 'error' ? token.message
        : hasEntry(token, 'value') ? (typeof token.value === 'bigint' ? `${token.value}n` : show(token.value))
        : ''
    return `${metadata.line}:${metadata.column}  ${token.kind}${detail === '' ? '' : `  ${detail}`}`
}

/**
 * `text` as one line per token.
 *
 * @type {(text: string) => string}
 */
export const tokensOf = text => toArray(tokenize(toArray(stringToCodePointList(text)))('')).map(line).join('\n')

/**
 * The text the page opens on: a bigint, a comment and a template with a
 * substitution, each a token kind of its own.
 *
 * @type {string}
 */
const overview = 'const answer = 42n // a bigint\nconst text = `x is ${answer}`\n'

/**
 * Opens on {@link overview}. A lexical error replaces the whole stream, so
 * no one text shows both outcomes; the second example is one the tokenizer
 * refuses.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    intro: 'Reads JavaScript text as tokens, one per line, with whitespace, newlines and comments kept. Each line shows the starting line and column, the token kind, and its value or error.',
    name: 'source',
    label: 'JavaScript',
    rows: 4,
    init: overview,
    examples: [
        ['Overview', overview, 'overview'],
        ['A number run into a name', 'const n = 123abc\n', 'a-number-run-into-a-name'],
    ],
    highlight,
})(text => [
    caption('Tokens, line:column, kind and value:'),
    ['pre', { [codeMarker]: '' }, tokensOf(text)],
])
