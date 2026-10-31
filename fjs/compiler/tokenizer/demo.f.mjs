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
 * **The listing is for inspection**, so it uses a neutral code box without
 * a copy button.
 *
 * @module
 *
 * @import { ModuleTokenWithMetadata } from './types.ts'
 */

import { codeMarker } from '../../website/style/module.f.js'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { caption } from '../../website/demo/module.f.mjs'
import { stageDemo } from '../stage_demo/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { hasEntry } from '../../types/object/entry/module.f.js'

/**
 * One token as a line: `line:column  kind  value`, with an error's message
 * and span in place of a value.
 *
 * @type {(t: ModuleTokenWithMetadata) => string}
 */
export const _line = ({ token, metadata }) => {
    const detail = token.kind === 'error'
        ? `${token.message}${token.end === undefined ? '' : ` (to ${token.end.line}:${token.end.column})`}`
        : hasEntry(token, 'value') ? (typeof token.value === 'bigint' ? `${token.value}n` : JSON.stringify(token.value)) : ''
    return `${metadata.line}:${metadata.column}  ${token.kind}${detail === '' ? '' : `  ${detail}`}`
}

/**
 * `text` as one line per token.
 *
 * @type {(text: string) => string}
 */
export const _tokensOf = text => toArray(tokenize(stringToList(text))('')).map(_line).join('\n')

export const demo = stageDemo({
    intro: 'Reads FunctionalScript source as tokens, one per line. Each line shows the starting line and column, the token kind, and its value or diagnostic; whitespace and comments are omitted.',
    name: 'tokenizer',
})(text => [
    caption('Tokens, line:column, kind and value:'),
    ['pre', { [codeMarker]: '' }, _tokensOf(text)],
])
