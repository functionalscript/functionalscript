import type * as Operator from '../../types/function/operator/module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { empty, flat, stateScan } = list
import * as bf from '../../types/bigfloat/module.f.ts'
const { multiply } = bf
import * as jsTokenizer from '../../js/tokenizer/module.f.ts'

export type JsonToken = |
    {readonly kind: 'true' | 'false' | 'null' } |
    {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
    jsTokenizer.StringToken |
    jsTokenizer.NumberToken |
    jsTokenizer.ErrorToken |
    jsTokenizer.EofToken

type ScanState = {readonly kind: 'def' | '-' }

type ScanInput = jsTokenizer.JsTokenWithMetadata | null

const mapToken
    : (input: jsTokenizer.JsToken) => list.List<JsonToken>
    = input => {
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
            case 'eof':
            case 'error': return [input]
            case 'ws':
            case 'nl': return empty
            default: return [{ kind: 'error', message: 'invalid token' }]
        }
    }

const parseDefaultState
    : (input: ScanInput) => readonly [list.List<JsonToken>, ScanState]
    = input => {
        if (input === null) return [empty, { kind: 'def'}]
        switch(input.token.kind)
        {
            case '-': return [empty, { kind: '-'}]
            default: return [mapToken(input.token),  { kind: 'def'}]
        }
    }

const parseMinusState
    : (input: ScanInput) => readonly [list.List<JsonToken>, ScanState]
    = input => {
        if (input === null) return [[{ kind: 'error', message: 'invalid token' }], { kind: 'def'}]
        switch(input.token.kind)
        {
            case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-'}]
            case 'number': return [[{ kind: 'number', bf: multiply(input.token.bf)(-1n), value: `-${input.token.value}` }], { kind: 'def'}]
            default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input.token)},  { kind: 'def'}]
        }
    }

const scanToken
    : Operator.StateScan<ScanInput, ScanState, list.List<JsonToken>>
    = state => input => {
        switch(state.kind)
        {
            case '-': return parseMinusState(input)
            default: return parseDefaultState(input)
        }
    }

export const tokenize
    = (input: list.List<number>): list.List<JsonToken> => {
        const jsTokens
            : list.List<ScanInput>
            =  jsTokenizer.tokenize(input)('')
        return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
    }
