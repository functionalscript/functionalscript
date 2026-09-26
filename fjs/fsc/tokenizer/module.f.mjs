/**
 * The module tokenizer: the JavaScript token stream of
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
 * JavaScript wants an identifier; and every operator but the four a
 * function is written with — `(`, `)`, `...`, `=>` — `-`, Stage A's
 * arithmetic, strict-comparison and bitwise operators and Stage B's lazy
 * ones with the conditional's `?`
 * ([`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md))
 * is an error, since the language has no other.
 *
 * This layer holds no state. An operator is a token like any other and the
 * grammar reads it, so that `-1 .x` and `-1()` are the negation of the
 * access and of the call, as JavaScript reads them, rather than an access
 * and a call on a negative literal — recognized is not accepted, and the
 * same is true of every operator token `fjs/js/tokenizer` already carries
 * that this layer does not admit, `?.` and `,` and the rest of
 * `spec/todo/2340-operators.md`'s later stages among them.
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

/**
 * Every `DjsToken` kind, `eof` included: the kinds a `JsToken` keeps
 * unchanged on its way to the module's stream. Pinned to `DjsToken['kind']` in
 * `./types.ts`, so a kind added there and forgotten here breaks the build
 * rather than becoming an invalid-token error at run time. The parser's
 * alphabet is this list less `eof`.
 *
 * Exported with a leading `_` for that linkage — the export is not API.
 */
export const _djsTokenKinds = /** @type {const} */ ([
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    '{', '}', ':', ',', '[', ']', '.', '=', ';', '(', ')', '=>', '...', '-',
    '+', '*', '/', '%', '**',
    '===', '!==', '>', '>=', '<', '<=',
    '&', '|', '^', '~', '<<', '>>', '>>>',
    '&&', '||', '??', '?',
    'string', 'number', 'error', 'id', 'bigint',
    'ws', 'nl', '//', '/*',
    'eof',
])

/** @type {ReadonlySet<string>} */
const djsTokenKindSet = new Set(_djsTokenKinds)

/**
 * A JavaScript token as a module token: kept when its kind is one of
 * {@link _djsTokenKinds} — the cast is that membership, which `Set#has`
 * cannot state as a narrowing — an `id` when it is any other keyword, and
 * an error otherwise: an operator the language does not admit.
 *
 * @type {(input: JsToken) => DjsToken}
 */
const mapDjsToken = input =>
    djsTokenKindSet.has(input.kind) ? /** @type {DjsToken} */ (input)
    : keywordSet.has(input.kind) ? { kind: 'id', value: input.kind }
    : { kind: 'error', message: 'invalid token' }

/** One token of the stream, with the metadata of the JavaScript token it came from. @type {(input: JsTokenWithMetadata) => DjsTokenWithMetadata} */
const mapDjsTokenWithMetadata = ({ token, metadata }) => ({ token: mapDjsToken(token), metadata })

/** @type {(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>} */
export const tokenize = input => path => map(mapDjsTokenWithMetadata)(tokenizeJs(input)(path))
