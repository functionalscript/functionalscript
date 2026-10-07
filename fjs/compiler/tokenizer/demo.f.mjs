/**
 * A FunctionalScript module as the tokens the tokenizer reads from it: type a
 * module, read one line per token — where it starts, its kind, and the text of
 * a name, string, number or bigint.
 *
 * **Trivia is not in the stream.** Whitespace and comments produce no token;
 * the only trace of them is the newline flag the parser asks about, which
 * this page does not draw.
 *
 * **A token the tokenizer cannot read is a line, not a failure.** An
 * `error` token carries its message and, where it knows how far the unread
 * source runs, the end of the span. A `\x41` escape shows up that way: the
 * grammar has no spelling of it inside a string, so it stops here, before the
 * parser sees it. An unfinished module is the other half — every token of
 * it read here, refused only by the parser — so the two pages together say
 * which stage a refusal belongs to.
 *
 * **It needs no operations.** Tokenizing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { DjsTokenWithMetadata } from './types.ts'
 */

import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'
import { examples } from '../examples/module.f.js'
import { tokenize } from './module.f.mjs'

/**
 * One token as a line: `line:column  kind  value`, with an error's message
 * and span in place of a value.
 *
 * @type {(t: DjsTokenWithMetadata) => string}
 */
export const _line = ({ token, metadata }) => {
    const detail = token.kind === 'error'
        ? `${token.message}${token.end === undefined ? '' : ` (to ${token.end.line}:${token.end.column})`}`
        : 'value' in token ? (typeof token.value === 'bigint' ? `${token.value}n` : JSON.stringify(token.value)) : ''
    return `${metadata.line}:${metadata.column}  ${token.kind}${detail === '' ? '' : `  ${detail}`}`
}

/**
 * `text` as one line per token.
 *
 * @type {(text: string) => string}
 */
export const _tokensOf = text => toArray(tokenize(stringToList(text))('')).map(_line).join('\n')

export const demo = textDemo({ name: 'tokenizer', label: 'Source', init: examples[0][1], examples })(text => [['pre', _tokensOf(text)]])
