// @ts-self-types="./module.f.d.mts"
import * as Operator from '../../types/function/operator/module.f.mjs'
import * as list from '../../types/list/module.f.mjs'
const { empty, flat, stateScan } = list
import * as bf from '../../types/bigfloat/module.f.mjs'
const { multiply } = bf
import * as jsTokenizer from '../../js/tokenizer/module.f.mjs'

/**
 * @typedef {|
* {readonly kind: 'true' | 'false' | 'null' } |
* {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
* jsTokenizer.StringToken |
* jsTokenizer.NumberToken |
* jsTokenizer.ErrorToken
* } JsonToken
*/

/**
 * @typedef {|
* {readonly kind: 'def' | '-' }
* } ScanState
*/

/**
 * @typedef {|
* jsTokenizer.JsToken | null
* } ScanInput
*/

/** @type {(input: jsTokenizer.JsToken) => list.List<JsonToken>} */
const mapToken = input =>
{
    switch(input.kind)
    {
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
        case 'error': return [input]
        case 'ws':
        case 'nl': return empty
        default: return [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<JsonToken>, ScanState]} */
const parseDefaultState = input =>
{
    if (input === null) return [empty, { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input),  { kind: 'def'}]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<JsonToken>, ScanState]} */
const parseMinusState = input =>
{
    if (input === null) return [[{ kind: 'error', message: 'invalid token' }], { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-'}]
        case 'number': return [[{ kind: 'number', bf: multiply(input.bf)(-1n), value: `-${input.value}` }], { kind: 'def'}]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input)},  { kind: 'def'}]
    }
}

/** @type {Operator.StateScan<ScanInput, ScanState, list.List<JsonToken>>} */
const scanToken = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

/** @type {(input: list.List<number>) => list.List<JsonToken>} */
export const tokenize = input =>
{
    /** @type {list.List<ScanInput>} */
    const jsTokens = jsTokenizer.tokenize(input)
    return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
}
