import { error, ok, type Result } from '../../types/result/module.f.ts'
import { fold, first, drop, toArray, length, concat, type List } from '../../types/list/module.f.ts'
import type { Fold } from '../../types/function/operator/module.f.ts'
import type { DjsToken, DjsTokenWithMetadata } from '../tokenizer/module.f.ts'
import { setReplace, at, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import { fromMap } from '../../types/object/module.f.ts'
import type { Fs } from '../../io/module.f.ts'
import type { AstArray, AstConst, AstModule, AstModuleRef } from '../ast/module.f.ts'
import type { TokenMetadata } from '../../js/tokenizer/module.f.ts'

export type ParseContext = {
    readonly fs: Fs
    readonly complete: OrderedMap<Result<AstModule, string>>
    readonly stack: List<string>
}

export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
}

type DjsStackArray = ['array', List<AstConst>]

type DjsStackObject = ['object', OrderedMap<AstConst>, string]

type DjsStackElement = |
    DjsStackArray |
    DjsStackObject

type DjsStack = List<DjsStackElement>

type ParserState = InitialState | NewLineRequiredState | ImportState | ConstState | ExportState | ParseValueState | ResultState | ErrorState

type ModuleState = {
    readonly refs: OrderedMap<AstModuleRef>
    readonly modules: List<string>
    readonly consts: List<AstConst>
}

type InitialState = {
   readonly state: ''
   readonly module: ModuleState
}

type NewLineRequiredState = {
    readonly state: 'nl'
    readonly module: ModuleState
}

type ImportState = {
   readonly state: 'import' | 'import+name' | 'import+from'
   readonly module: ModuleState
}

type ConstState = {
   readonly state: 'const' | 'const+name'
   readonly module: ModuleState
}

type ExportState = {
   readonly state: 'export'
   readonly module: ModuleState
}

type ParseValueState = {
   readonly state: 'constValue' | 'exportValue'
   readonly module: ModuleState
   readonly valueState: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
   readonly top: DjsStackElement | null
   readonly stack: DjsStack
}

type ResultState = {
   readonly state: 'result'
   readonly module: ModuleState
}

type ErrorState = {
    readonly state: 'error'
    readonly error: ParseError
}

const parseInitialOp
    : (token: DjsTokenWithMetadata) => (state: InitialState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            switch (token.value) {
                case 'import': return { ... state, state: 'import' }
                case 'const': return { ... state, state: 'const' }
                case 'export': return { ... state, state: 'export' }
            }
        }
    }
    return foldOp({token, metadata})({ ... state, state: 'exportValue', valueState: '', top: null, stack: null })
}

const parseNewLineRequiredOp
    : (token: DjsTokenWithMetadata) => (state: NewLineRequiredState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case '//':
        case '/*': return state
        case 'nl': return { ... state, state: '' }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseExportOp
    : (token: DjsTokenWithMetadata) => (state: ExportState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        case 'id': {
            if (token.value === 'default') return { ... state, state: 'exportValue', valueState: '', top: null, stack: null }
        }
    }
    return { state: 'error', error: { message: 'unexpected token', metadata} }
}

const parseResultOp
    : (token: DjsTokenWithMetadata) => (state: ResultState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*':
        case 'eof': return state
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseConstOp
    : (token: DjsTokenWithMetadata) => (state: ConstState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null)
                return { state: 'error', error: { message: 'duplicate id', metadata} }
            const cref
                : AstModuleRef
                = ['cref', length(state.module.consts)]
            const refs = setReplace(token.value)(cref)(state.module.refs)
            return { ... state, state: 'const+name', module: { ...state.module, refs: refs } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseConstNameOp
    : (token: DjsTokenWithMetadata) => (state: ConstState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case '=': return { ... state, state: 'constValue', valueState: '', top: null, stack: null }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseImportOp
    : (token: DjsTokenWithMetadata) => (state: ImportState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null) {
                return { state: 'error', error: { message: 'duplicate id', metadata} }
            }
            const aref
                : AstModuleRef
                = ['aref', length(state.module.modules)]
            const refs = setReplace(token.value)(aref)(state.module.refs)
            return { ... state, state: 'import+name', module: { ...state.module, refs: refs } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseImportNameOp
    : (token: DjsTokenWithMetadata) => (state: ImportState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        case 'id': {
            if (token.value === 'from') return { ... state, state: 'import+from' }
        }
    }
    return { state: 'error', error: { message: 'unexpected token', metadata} }
}

const parseImportFromOp
    : (token: DjsTokenWithMetadata) => (state: ImportState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'string': {
            const modules = concat(state.module.modules)([token.value])
            return { ... state, state: 'nl', module: { ...state.module, modules: modules } }
        }
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const addKeyToObject
    : (obj: DjsStackObject) => (key: string) => DjsStackObject
    = obj => key => ([ 'object', obj[1], key])

const addValueToObject
    : (obj: DjsStackObject) => (value: AstConst) => DjsStackObject
    = obj => value => ([ 'object', setReplace(obj[2])(value)(obj[1]), '' ])

const addToArray
    : (array: DjsStackArray) => (value: AstConst) => DjsStackArray
    = array => value => ([ 'array', concat(array[1])([value]) ])

const pushKey
    : (state: ParseValueState) => (key: string) => (metadata: TokenMetadata) => ParserState
    = state => key => metadata => {
    if (state.top?.[0] === 'object') { return { ... state, valueState: '{k', top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', error: { message: 'error', metadata} }
}

const pushValue
    : (state: ParseValueState) => (value: AstConst) => ParserState
    = state => value => {
    if (state.top === null) {
        const consts = concat(state.module.consts)([value])
        switch(state.state)
        {
            case 'exportValue': return { ... state, state: 'result', module: { ...state.module, consts: consts }}
            case 'constValue': return { ... state, state: 'nl', module: { ...state.module, consts: consts }}
        }
    }
    if (state.top?.[0] === 'array') { return { ... state, valueState: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { ... state, valueState: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

const pushRef
    : (state: ParseValueState) => (name: string) => (metadata: TokenMetadata) => ParserState
    = state => name => metadata => {
    const ref = at(name)(state.module.refs)
    if (ref === null)
        return { state: 'error', error: { message: 'const not found', metadata} }
    return pushValue(state)(ref)
}

const startArray
    : (state: ParseValueState) => ParserState
    = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '[', top: ['array', null ], stack: newStack }
}

const endArray
    : (state: ParseValueState) => ParserState
    = state => {
    const top = state.top;
    const newState
        : ParseValueState
        = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    if (top !== null && top[0] === 'array')
    {
        const array
            : AstArray
            = ['array', toArray(top[1])];
        return pushValue(newState)(array)
    }
    return pushValue(newState)(null)
}

const startObject
    : (state: ParseValueState) => ParserState
    = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '{', top: ['object', null, ''], stack: newStack }
}

const endObject
    : (state: ParseValueState) => ParserState
    = state => {
    const obj = state?.top !== null && state?.top[0] === 'object' ? fromMap(state.top[1]) : null;
    const newState
        : ParseValueState
        = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(obj)
}

const tokenToValue
    : (token: DjsToken) => AstConst
    = token => {
    switch (token.kind) {
        case 'null': return null
        case 'false': return false
        case 'true': return true
        case 'number': return parseFloat(token.value)
        case 'string': return token.value
        case 'bigint': return token.value
        case 'undefined': return undefined
        default: return null
    }
}

const isValueToken
    : (token: DjsToken) => boolean
    = token => {
    switch (token.kind) {
        case 'null':
        case 'false':
        case 'true':
        case 'number':
        case 'string':
        case 'bigint':
        case 'undefined': return true
        default: return false
    }
}

const parseValueOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case ']':
            if (state.valueState === '[,') { return endArray(state) }
            return { state: 'error', error: { message: 'unexpected token', metadata} }
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default:
            if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
            return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseArrayStartOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case ']': return endArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseArrayValueOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case ']': return endArray(state)
        case ',': return { ... state, valueState: '[,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

// allow identifier property names (#2410)
const parseObjectStartOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case 'string':
        case 'id':
            return pushKey(state)(String(token.value))(metadata)
        case '}': return endObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseObjectKeyOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case ':': return { ... state, valueState: '{:', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseObjectColonOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)(metadata)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseObjectNextOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case ',': return { ... state, valueState: '{,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const parseObjectCommaOp
    : (token: DjsTokenWithMetadata) => (state: ParseValueState) => ParserState
    = ({token, metadata}) => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case 'string':
        case 'id':
            return pushKey(state)(String(token.value))(metadata)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'eof': return { state: 'error', error: { message: 'unexpected end', metadata} }
        default: return { state: 'error', error: { message: 'unexpected token', metadata} }
    }
}

const foldOp
    : Fold<DjsTokenWithMetadata, ParserState>
    = token => state => {
    switch (state.state) {
        case '': return parseInitialOp(token)(state)
        case 'nl': return parseNewLineRequiredOp(token)(state)
        case 'import': return parseImportOp(token)(state)
        case 'import+name': return parseImportNameOp(token)(state)
        case 'import+from': return parseImportFromOp(token)(state)
        case 'const': return parseConstOp(token)(state)
        case 'const+name': return parseConstNameOp(token)(state)
        case 'export': return parseExportOp(token)(state)
        case 'result': return parseResultOp(token)(state)
        case 'error': return { state: 'error', error: state.error }
        case 'constValue':
        case 'exportValue':
        {
            switch (state.valueState)
            {
                case '': return parseValueOp(token)(state)
                case '[': return parseArrayStartOp(token)(state)
                case '[v': return parseArrayValueOp(token)(state)
                case '[,': return parseValueOp(token)(state)
                case '{': return parseObjectStartOp(token)(state)
                case '{k': return parseObjectKeyOp(token)(state)
                case '{:': return parseObjectColonOp(token)(state)
                case '{v': return parseObjectNextOp(token)(state)
                case '{,': return parseObjectCommaOp(token)(state)
            }
        }
    }
}

export const parseFromTokens = (tokenList: List<DjsTokenWithMetadata>): Result<AstModule, ParseError> => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null }})(tokenList)
    switch (state.state) {
        case 'result': return ok<AstModule>([ toArray(state.module.modules), toArray(state.module.consts) ])
        case 'error': return error(state.error)
        default: return error({message: 'unexpected end', metadata: null})
    }
}
