/**
 * Tokenizer for JSON lexical analysis.
 *
 * @module
 */

/** @import { StateScan } from '../../../types/function/operator/types.ts' */
/** @import { List } from '../../../types/list/types.ts' */
import { concat, empty, flat, stateScan } from '../../../types/list/module.f.mjs'
import { multiply } from '../../../types/bigfloat/module.f.mjs'
import { tokenize as jsTokenize } from '../../../js/tokenizer/module.f.mjs'
/** @import { JsToken } from '../../../js/tokenizer/types.ts' */
/** @import { JsonToken, _ScanState, _ScanInput } from './types.ts' */

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
        case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-' }]
        case 'number': return [[{ kind: 'number', bf: multiply(input.token.bf)(-1n), value: `-${input.token.value}` }], { kind: 'def' }]
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
