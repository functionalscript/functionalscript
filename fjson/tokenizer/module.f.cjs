const operator = require('../../types/function/operator/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { empty, flat, stateScan } = list
const { multiply } = require('../../types/bigfloat/module.f.cjs')
const jsTokenizer = require('../../js/tokenizer/module.f.cjs')

/**
 * @typedef {|
* {readonly kind: 'true' | 'false' | 'null'} |
* {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
* jsTokenizer.StringToken |
* jsTokenizer.NumberToken |
* jsTokenizer.ErrorToken |
* jsTokenizer.IdToken |
* jsTokenizer.BigIntToken
* } FjsonToken
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

/** @type {(input: jsTokenizer.JsToken) => list.List<FjsonToken>} */
const mapToken = input =>
{
    switch(input.kind)
    {
        case 'id':
        case 'bigint':
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
        case 'kw': return [{ kind: 'id', value: input.name }]
        default: return [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<FjsonToken>, ScanState]} */
const parseDefaultState = input =>
{
    if (input === null) return [empty, { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input),  { kind: 'def'}]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<FjsonToken>, ScanState]} */
const parseMinusState = input =>
{
    if (input === null) return [[{ kind: 'error', message: 'invalid token' }], { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-'}]
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def'}]
        case 'number': return [[{ kind: 'number', bf: multiply(input.bf)(-1n), value: `-${input.value}` }], { kind: 'def'}]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input)},  { kind: 'def'}]
    }
}

/** @type {operator.StateScan<ScanInput, ScanState, list.List<FjsonToken>>} */
const scanToken = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

/** @type {(input: list.List<number>) => list.List<FjsonToken>} */
const tokenize = input =>
{
    /** @type {list.List<ScanInput>} */
    const jsTokens = jsTokenizer.tokenize(input)
    return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
}

module.exports = {
    /** @readonly */
    tokenize
}