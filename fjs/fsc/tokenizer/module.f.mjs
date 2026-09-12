/**
 * The DJS tokenizer: the JavaScript token stream of
 * [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs), folded once more.
 *
 * ```text
 * code points ==fjs/js/tokenizer: the grammar, then its fold==> JsToken stream
 *             ==fold: keywords demoted, `-` folded into a number==> DjsToken stream
 * ```
 *
 * The grammar is [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs) and
 * the tokens are its too, `fjs/ebnf/lib/js/types.ts`; the two layers below
 * this one — the grammar read one token at a time, and the fold that
 * merges trivia, classifies words and checks the number boundary — are
 * the JavaScript tokenizer's, shared with every other reader of JavaScript
 * text. What this layer adds is the language's: every keyword is demoted
 * to an identifier but the literals — `true`, `false`, `null`,
 * `undefined`, `NaN`, `Infinity` — which stay reserved; a `-` folds into
 * the number, bigint or `Infinity` after it, and is an error before
 * anything else; and every other operator is an error, since the data
 * language has none.
 *
 * @module
 *
 * @import { JsToken, JsTokenWithMetadata, TokenMetadata } from '../../ebnf/lib/js/types.ts'
 * @import { StateScan } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsToken, DjsTokenWithMetadata } from './types.ts'
 * @import { _DjsScanState } from './private.ts'
 */
import { tokenize as tokenizeJs } from '../../js/tokenizer/module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'
import { empty, flat, map, stateScan } from '../../types/list/module.f.mjs'

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

// -- layer 3: the DjsToken stream -------------------------------------------

/** @type {(input: JsToken) => List<DjsToken>} */
const mapDjsToken = input => {
    switch (input.kind) {
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
        case 'error': return [input]
        default: return keywordSet.has(input.kind) ? [{ kind: 'id', value: input.kind }] : [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: JsToken) => readonly [List<DjsToken>, _DjsScanState]} */
const parseDjsDefaultState = input => {
    switch (input.kind) {
        case 'eof': return [[{ kind: 'eof' }], { kind: 'def' }]
        case '-': return [empty, { kind: '-' }]
        default: return [mapDjsToken(input), { kind: 'def' }]
    }
}

// Folds a leading '-' into the following number/bigint token, mirroring the old
// fjs/fsc/tokenizer's minus-state exactly.
//
// No `case '-'` here: the grammar reads two adjacent `-` characters as the
// single `'--'` token (the decrement operator), so this state — entered only
// after a single `-` — can never itself see another `'-'`-kind input. Such an
// input falls through to `default`, which handles it exactly like any other
// non-number/bigint/eof token.
/** @type {(input: JsToken) => readonly [List<DjsToken>, _DjsScanState]} */
const parseDjsMinusState = input => {
    switch (input.kind) {
        case 'eof': return [[{ kind: 'error', message: 'invalid token' }, { kind: 'eof' }], { kind: 'def' }]
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def' }]
        // negation is lexical: the minus sign joins the lexeme, so the token
        // stays the exact source text of the number.
        case 'number': return [[{ kind: 'number', value: `-${input.value}` }], { kind: 'def' }]
        // and `-Infinity` is a word of its own, as DataJS spells it; `-NaN`
        // is not, and falls through to the error with the rest
        case 'Infinity': return [[{ kind: '-Infinity' }], { kind: 'def' }]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapDjsToken(input) }, { kind: 'def' }]
    }
}

/** @type {StateScan<JsToken, _DjsScanState, List<DjsToken>>} */
const scanDjsToken = (input, state) => {
    switch (state.kind) {
        case '-': return parseDjsMinusState(input)
        default: return parseDjsDefaultState(input)
    }
}

/** @type {(metadata: TokenMetadata) => (token: DjsToken) => DjsTokenWithMetadata} */
const mapDjsTokenWithMetadata = metadata => token => ({ token, metadata })

/** @type {StateScan<JsTokenWithMetadata, _DjsScanState, List<DjsTokenWithMetadata>>} */
const scanDjsTokenWithMetadata = (input, state) => {
    const [djsTokens, newState] = scanDjsToken(input.token, state)
    return [map(mapDjsTokenWithMetadata(input.metadata))(djsTokens), newState]
}

/** @type {(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>} */
export const tokenize = input => path => flat(stateScan(scanDjsTokenWithMetadata)({ kind: 'def' })(tokenizeJs(input)(path)))
