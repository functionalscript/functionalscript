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
  jsTokenizer.CommentToken |
  jsTokenizer.EofToken

export type DjsTokenWithMetadata = {readonly token: DjsToken,  readonly metadata: jsTokenizer.TokenMetadata}

type ScanState = {readonly kind: 'def' | '-' }

type ScanInput = jsTokenizer.JsTokenWithMetadata | null

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
        case 'eof':
        case 'error': return [input]
        default: return jsTokenizer.isKeywordToken(input) ? [{ kind: 'id', value: input.kind }] : [{ kind: 'error', message: 'invalid token' }]
    }
}

const parseDefaultState
    : (input: jsTokenizer.JsToken) => readonly [list.List<DjsToken>, ScanState]
    = input =>
{
    switch(input.kind)
    {
        case '-': return [empty, { kind: '-'}]
        default: return [mapToken(input),  { kind: 'def'}]
    }
}

const parseMinusState
    : (input: jsTokenizer.JsToken) => readonly [list.List<DjsToken>, ScanState]
    = input =>
{
    switch(input.kind)
    {
        case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-'}]
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def'}]
        case 'number': return [[{ kind: 'number', bf: multiply(input.bf)(-1n), value: `-${input.value}` }], { kind: 'def'}]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapToken(input)},  { kind: 'def'}]
    }
}

const scanToken
    : Operator.StateScan<jsTokenizer.JsToken, ScanState, list.List<DjsToken>>
    = state => input => {
    switch(state.kind)
    {
        case '-': return parseMinusState(input)
        default: return parseDefaultState(input)
    }
}

const mapTokenWithMetadata
    : (metadata: jsTokenizer.TokenMetadata) => (token: DjsToken) => DjsTokenWithMetadata
    = metadata => token => { return{ token, metadata }}

const scanTokenWithMetadata
    : Operator.StateScan<ScanInput, ScanState, list.List<DjsTokenWithMetadata>>
    = state => (input) => {
        if (input === null) {
            switch(state.kind)
            {
                case '-': return [[{token: {kind: 'error', message: 'invalid token' }, metadata: {path: '', line: 0, column: 0}}], { kind: 'def'}]
                default: return [empty, { kind: 'def'}]
            }
        }
        const [djsTokens, newState] = scanToken(state)(input.token)
        const djsTokensWithMetadata = list.map(mapTokenWithMetadata(input.metadata))(djsTokens)
        return [djsTokensWithMetadata, newState]
}

export const tokenize
    : (input: list.List<number>) => (path: string) => list.List<DjsTokenWithMetadata>
    = input => path =>
{
    const jsTokens
        : list.List<ScanInput>
        = jsTokenizer.tokenize(input)(path)
    return flat(stateScan(scanTokenWithMetadata)({ kind: 'def' })(list.concat(jsTokens)([null])))
}
