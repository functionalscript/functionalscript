/**
 * The DJS tokenizer: the JavaScript token stream of
 * [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs), folded once more.
 *
 * ```text
 * code points ==fjs/js/tokenizer: the grammar, then its fold==> JsToken stream
 *             ==fold: keywords demoted==> DjsToken stream
 * ```
 *
 * The grammar is [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs) and
 * the tokens are its too, `fjs/ebnf/lib/js/types.ts`; the two layers below
 * this one — the grammar read one token at a time, and the fold that
 * merges trivia, classifies words and checks the number boundary — are
 * the JavaScript tokenizer's, shared with every other reader of JavaScript
 * text. What this layer adds is the language's: every keyword is demoted
 * to an identifier but the literals — `true`, `false`, `null`,
 * `undefined`, `NaN`, `Infinity` — which stay reserved, since a key or the
 * name after `.` may be any word and the parser refuses a keyword where
 * JavaScript wants an identifier; and every operator but `-` and the four
 * a function is written with — `(`, `)`, `...`, `=>` — is an error, since
 * the language has no other.
 *
 * This layer holds no state. A `-` is a token like any other and the
 * grammar reads it as the prefix it is, so that `-1 .x` and `-1()` are the
 * negation of the access and of the call, as JavaScript reads them, rather
 * than an access and a call on a negative literal.
 *
 * @module
 *
 * @import { JsToken, JsTokenWithMetadata } from '../../ebnf/lib/js/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsToken, DjsTokenWithMetadata } from './types.ts'
 */
import { tokenize as tokenizeJs } from '../../js/tokenizer/module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'
import { map } from '../../types/list/module.f.mjs'

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

// -- layer 3: the DjsToken stream -------------------------------------------

/** @type {(input: JsToken) => DjsToken} */
const mapDjsToken = input => {
    switch (input.kind) {
        case '-':
        case 'id':
        case 'bigint':
        case '{':
        case '}':
        case ':':
        case ',':
        case '[':
        case ']':
        case '.':
        case '=':
        case ';':
        case '(':
        case ')':
        case '=>':
        case '...':
        case 'true':
        case 'false':
        case 'null':
        case 'string':
        case 'number':
        case 'ws':
        case 'nl':
        case 'undefined':
        case 'NaN':
        case 'Infinity':
        case '//':
        case '/*':
        case 'eof':
        case 'error': return input
        default: return keywordSet.has(input.kind) ? { kind: 'id', value: input.kind } : { kind: 'error', message: 'invalid token' }
    }
}

/** One token of the stream, with the metadata of the JavaScript token it came from. @type {(input: JsTokenWithMetadata) => DjsTokenWithMetadata} */
const mapDjsTokenWithMetadata = ({ token, metadata }) => ({ token: mapDjsToken(token), metadata })

/** @type {(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>} */
export const tokenize = input => path => map(mapDjsTokenWithMetadata)(tokenizeJs(input)(path))
