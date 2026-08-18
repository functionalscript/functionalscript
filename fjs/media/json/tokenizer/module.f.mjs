/**
 * Tokenizer for JSON lexical analysis.
 *
 * @module
 *
 * @import { StateScan } from '../../../types/function/operator/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { JsToken } from '../../../js/tokenizer/types.ts'
 * @import { JsonToken, _ScanState, _ScanInput } from './types.ts'
 */

import { concat, empty, flat, stateScan, toArray } from '../../../types/list/module.f.mjs'
import { tokenize as jsTokenize } from '../../../js/tokenizer/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

/** @type {(input: JsToken) => List<JsonToken>} */
const mapToken = input => {
    switch (input.kind) {
        case '{':
        case '}':
        case ':':
        case ',':
        case '[':
        case ']':
        case 'true':
        case 'false':
        case 'null':
        case 'string':
        case 'number':
        case 'eof':
        case 'error': return [input]
        case 'ws':
        case 'nl': return empty
        default: return [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: _ScanInput) => readonly [List<JsonToken>, _ScanState]} */
const parseDefaultState = input => {
    if (input === null) return [empty, { kind: 'def' }]
    switch (input.token.kind) {
        case '-': return [empty, { kind: '-' }]
        default: return [mapToken(input.token), { kind: 'def' }]
    }
}

/** @type {(input: _ScanInput) => readonly [List<JsonToken>, _ScanState]} */
const parseMinusState = input => {
    if (input === null) return [[{ kind: 'error', message: 'invalid token' }], { kind: 'def' }]
    switch (input.token.kind) {
        // negation is lexical: the minus sign joins the lexeme, so the token
        // stays the exact source text of the JSON number.
        case 'number': return [[{ kind: 'number', value: `-${input.token.value}` }], { kind: 'def' }]
        // No `'-'` case: the underlying JS tokenizer always merges adjacent
        // `-` characters into a single `'--'` token (see `js/tokenizer`), so
        // this state never sees a second `'-'` — a run of `-` past the first
        // always falls through to the `default` arm below instead.
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input.token) }, { kind: 'def' }]
    }
}

/** @type {StateScan<_ScanInput, _ScanState, List<JsonToken>>} */
const scanToken = (input, state) => {
    switch (state.kind) {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

/**
 * Converts a stream of UTF-8 bytes into JSON tokens.
 *
 * The tokenizer accepts only JSON-compatible JavaScript tokens, ignores
 * whitespace/newline tokens, and reports invalid token sequences as
 * `{ kind: 'error' }` tokens.
 *
 * @type {(input: List<number>) => List<JsonToken>}
 */
export const tokenize = input => {
    /** @type {List<_ScanInput>} */
    const jsTokens = jsTokenize(input)('')
    return flat(stateScan(scanToken)({ kind: 'def' })(concat(jsTokens)([null])))
}

export const proof = {
    // `parseMinusState` only sees `null` if the JSON tokenizer's own EOF
    // sentinel arrives while still in state '-' — i.e. input ends right after
    // a lone `-`. Unreachable through the public `tokenize`: the underlying
    // JS tokenizer always emits its own `eof` token first, and consuming that
    // (the default branch, any kind other than '-' or 'number') resets state
    // to 'def' before the sentinel `null` is ever seen. Call the private
    // state handler directly to cover the branch anyway.
    parseMinusStateEof: () => {
        const [tokens, state] = parseMinusState(null)
        assertEq(state.kind, 'def')
        const a = toArray(tokens)
        assertEq(a.length, 1)
        assertEq(a[0].kind, 'error')
    },
}
