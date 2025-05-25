import type * as Operator from '../../types/function/operator/module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { empty, flat, stateScan } = list
import * as bf from '../../types/bigfloat/module.f.ts'
const { multiply } = bf
import * as jsTokenizer from '../../js/tokenizer/module.f.ts'

export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' } |
  jsTokenizer.StringToken |
  jsTokenizer.NumberToken |
  jsTokenizer.ErrorToken |
  jsTokenizer.IdToken |
  jsTokenizer.BigIntToken |
  jsTokenizer.WhitespaceToken |
  jsTokenizer.NewLineToken |
  jsTokenizer.CommentToken

type ScanState = {readonly kind: 'def' | '-' }

type ScanInput = | jsTokenizer.JsTokenWithMetadata | null

const mapToken
    : (input: jsTokenizer.JsToken) => list.List<DjsToken>
    = input =>
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
        case 'nl':
        case 'undefined':
        case '//':
        case '/*':
        case 'error': return [input]
        default: return jsTokenizer.isKeywordToken(input) ? [{ kind: 'id', value: input.kind }] : [{ kind: 'error', message: 'invalid token' }]
    }
}

const parseDefaultState
    : (input: ScanInput) => readonly [list.List<DjsToken>, ScanState]
    = input =>
{
    if (input === null) return [empty, { kind: 'def'}]
    switch(input.token.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input.token),  { kind: 'def'}]
    }
}

const parseMinusState
    : (input: ScanInput) => readonly [list.List<DjsToken>, ScanState]
    = input =>
{
    if (input === null) return [[{ kind: 'error', message: 'invalid token' }], { kind: 'def'}]
    switch(input.token.kind)
    {
        case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-'}]
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.token.value }], { kind: 'def'}]
        case 'number': return [[{ kind: 'number', bf: multiply(input.token.bf)(-1n), value: `-${input.token.value}` }], { kind: 'def'}]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input.token)},  { kind: 'def'}]
    }
}

const scanToken
    : Operator.StateScan<ScanInput, ScanState, list.List<DjsToken>>
    = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

export const tokenize
    : (input: list.List<number>) => list.List<DjsToken>
    = input =>
{
    const jsTokens
        : list.List<ScanInput>
        = jsTokenizer.tokenize(input)
    return flat(stateScan(scanToken)({ kind: 'def' })(list.concat(jsTokens)([null])))
}
