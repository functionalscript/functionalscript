import operator, * as Operator from '../../types/function/operator/module.f.mjs'
import list from '../../types/list/module.f.cjs'
const { empty, flat, stateScan } = list
import bf from '../../types/bigfloat/module.f.mjs'
const { multiply } = bf
import jsTokenizer, * as jsTokenizerT from '../../js/tokenizer/module.f.mjs'

/**
 * @typedef {|
* {readonly kind: 'true' | 'false' | 'null'} |
* {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' } |
* jsTokenizerT.StringToken |
* jsTokenizerT.NumberToken |
* jsTokenizerT.ErrorToken |
* jsTokenizerT.IdToken |
* jsTokenizerT.BigIntToken |
* jsTokenizerT.WhitespaceToken
* } DjsToken
*/

/**
 * @typedef {|
* {readonly kind: 'def' | '-' }
* } ScanState
*/

/**
 * @typedef {|
* jsTokenizerT.JsToken | null
* } ScanInput
*/

/** @type {(input: jsTokenizerT.JsToken) => list.List<DjsToken>} */
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
        case '.':
        case '=':
        case 'true':
        case 'false':
        case 'null':
        case 'string':
        case 'number':
        case 'ws':
        case 'error': return [input]
        default: return jsTokenizer.isKeywordToken(input) ? [{ kind: 'id', value: input.kind }] : [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<DjsToken>, ScanState]} */
const parseDefaultState = input =>
{
    if (input === null) return [empty, { kind: 'def'}]
    switch(input.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input),  { kind: 'def'}]
    }
}

/** @type {(input: ScanInput) => readonly [list.List<DjsToken>, ScanState]} */
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

/** @type {Operator.StateScan<ScanInput, ScanState, list.List<DjsToken>>} */
const scanToken = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

/** @type {(input: list.List<number>) => list.List<DjsToken>} */
const tokenize = input =>
{
    /** @type {list.List<ScanInput>} */
    const jsTokens = jsTokenizer.tokenize(input)
    return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
}

export default {
    /** @readonly */
    tokenize
}