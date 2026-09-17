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
 * `undefined`, `NaN`, `Infinity` — which stay reserved, since a key or the
 * name after `.` may be any word and the parser refuses a keyword where
 * JavaScript wants an identifier; a `-` immediately before a number, bigint
 * or `Infinity` folds into it rather than standing as its own token; the
 * Stage A operators of `spec/todo/2340-operators.md` — arithmetic, strict
 * comparison, bitwise — and the four a function is written with — `(`, `)`,
 * `...`, `=>` — pass through; every other operator is an error, since the
 * language has no other.
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
        case '(':
        case ')':
        case '=>':
        case '...':
        case '+':
        case '*':
        case '/':
        case '%':
        case '**':
        case '===':
        case '!==':
        case '>':
        case '>=':
        case '<':
        case '<=':
        case '&':
        case '|':
        case '^':
        case '~':
        case '<<':
        case '>>':
        case '>>>':
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

// Folds a leading '-' into an immediately adjacent number/bigint/`Infinity`
// token — `-1` and `-Infinity` stay one token each, as DataJS spells them —
// and otherwise emits a real `-` operator token ahead of whatever follows,
// unary or binary minus being the grammar's to tell apart
// (`spec/todo/2340-operators.md`).
//
// No `case '-'` here: the grammar reads two adjacent `-` characters as the
// single `'--'` token (the decrement operator, which this language has no
// use for and `mapDjsToken` errors on), so this state — entered only after
// a single `-` — can never itself see another `'-'`-kind input. Such an
// input falls through to `default`, which reuses `parseDjsDefaultState`
// unchanged.
/** @type {(input: JsToken) => readonly [List<DjsToken>, _DjsScanState]} */
const parseDjsMinusState = input => {
    switch (input.kind) {
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def' }]
        // negation is lexical: the minus sign joins the lexeme, so the token
        // stays the exact source text of the number.
        case 'number': return [[{ kind: 'number', value: `-${input.value}` }], { kind: 'def' }]
        // and `-Infinity` is a word of its own, as DataJS spells it; `-NaN`
        // is not, and falls through to the operator token with the rest
        case 'Infinity': return [[{ kind: '-Infinity' }], { kind: 'def' }]
        default: {
            const [rest, state] = parseDjsDefaultState(input)
            return [{ first: { kind: '-' }, tail: rest }, state]
        }
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
