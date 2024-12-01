import * as Operator from '../../types/function/operator/module.f.mjs'
import list, * as List from '../../types/list/module.f.mjs'
const { empty, flat, stateScan } = list
import bf from '../../types/bigfloat/module.f.mjs'
const { multiply } = bf
import jsTokenizer, * as JsTokenizer from '../../js/tokenizer/module.f.mjs'

/**
 * @typedef {|
* {readonly kind: 'true' | 'false' | 'null' } |
* {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
* JsTokenizer.StringToken |
* JsTokenizer.NumberToken |
* JsTokenizer.ErrorToken
* } JsonToken
*/

/**
 * @typedef {|
* {readonly kind: 'def' | '-' }
* } ScanState
*/

/**
 * @typedef {|
* JsTokenizer.JsToken | null
* } ScanInput
*/

/** @type {(input: JsTokenizer.JsToken) => List.List<JsonToken>} */
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
        case 'ws': return empty
        default: return [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: ScanInput) => readonly [List.List<JsonToken>, ScanState]} */
const parseDefaultState = input =>
{
    if (input === null) return [empty, { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input),  { kind: 'def'}]
    }
}

/** @type {(input: ScanInput) => readonly [List.List<JsonToken>, ScanState]} */
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

/** @type {Operator.StateScan<ScanInput, ScanState, List.List<JsonToken>>} */
const scanToken = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

/** @type {(input: List.List<number>) => List.List<JsonToken>} */
const tokenize = input =>
{
    /** @type {List.List<ScanInput>} */
    const jsTokens = jsTokenizer.tokenize(input)
    return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
}

export default {
    /** @readonly */
    tokenize
}
