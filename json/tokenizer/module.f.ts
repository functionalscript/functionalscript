import { type StateScan } from '../../types/function/operator/module.f.ts'
import { concat, empty, flat, stateScan, type List } from '../../types/list/module.f.ts'
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
    : (input: jsTokenizer.JsToken) => List<JsonToken>
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
    : (input: ScanInput) => readonly [List<JsonToken>, ScanState]
    = input => {
        if (input === null) return [empty, { kind: 'def'}]
        switch(input.token.kind)
        {
            case '-': return [empty, { kind: '-'}]
            default: return [mapToken(input.token),  { kind: 'def'}]
        }
    }

const parseMinusState
    : (input: ScanInput) => readonly [List<JsonToken>, ScanState]
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
    : StateScan<ScanInput, ScanState, List<JsonToken>>
    = state => input => {
        switch(state.kind)
        {
            case '-': return parseMinusState(input)
            default: return parseDefaultState(input)
        }
    }

export const tokenize
    = (input: List<number>): List<JsonToken> => {
        const jsTokens
            : List<ScanInput>
            =  jsTokenizer.tokenize(input)('')
        return flat(stateScan(scanToken)({ kind: 'def' })(concat(jsTokens)([null])))
    }
