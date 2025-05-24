import * as result from '../../types/result/module.f.ts'
import { fold, first, drop, toArray, length, concat, type List } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import type { DjsToken } from '../tokenizer/module.f.ts'
import { setReplace, at, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import { fromMap } from '../../types/object/module.f.ts'
import type { Fs } from '../../io/module.f.ts'
import type { AstArray, AstConst, AstModule, AstModuleRef } from '../ast/module.f.ts'

export type ParseContext = {
    readonly fs: Fs
    readonly complete: OrderedMap<result.Result<AstModule, string>>
    readonly stack: List<string>
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
    readonly message: string
}

const parseInitialOp
    : (token: DjsToken) => (state: InitialState) => ParserState
    = token => state => {
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
    return foldOp(token)({ ... state, state: 'exportValue', valueState: '', top: null, stack: null })
}

const parseNewLineRequiredOp
    : (token: DjsToken) => (state: NewLineRequiredState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case '//':
        case '/*': return state
        case 'nl': return { ... state, state: '' }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseExportOp
    : (token: DjsToken) => (state: ExportState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (token.value === 'default') return { ... state, state: 'exportValue', valueState: '', top: null, stack: null }
        }
    }
    return { state: 'error', message: 'unexpected token' }
}

const parseResultOp
    : (token: DjsToken) => (state: ResultState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseConstOp
    : (token: DjsToken) => (state: ConstState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null)
                return { state: 'error', message: 'duplicate id' }
            const cref
                : AstModuleRef
                = ['cref', length(state.module.consts)]
            const refs = setReplace(token.value)(cref)(state.module.refs)
            return { ... state, state: 'const+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseConstNameOp
    : (token: DjsToken) => (state: ConstState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case '=': return { ... state, state: 'constValue', valueState: '', top: null, stack: null }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseImportOp
    : (token: DjsToken) => (state: ImportState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null) {
                return { state: 'error', message: 'duplicate id' }
            }
            const aref
                : AstModuleRef
                = ['aref', length(state.module.modules)]
            const refs = setReplace(token.value)(aref)(state.module.refs)
            return { ... state, state: 'import+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseImportNameOp
    : (token: DjsToken) => (state: ImportState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (token.value === 'from') return { ... state, state: 'import+from' }
        }
    }
    return { state: 'error', message: 'unexpected token' }
}

const parseImportFromOp
    : (token: DjsToken) => (state: ImportState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'string': {
            const modules = concat(state.module.modules)([token.value])
            return { ... state, state: 'nl', module: { ...state.module, modules: modules } }
        }
        default: return { state: 'error', message: 'unexpected token' }
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
    : (state: ParseValueState) => (key: string) => ParserState
    = state => key => {
    if (state.top?.[0] === 'object') { return { ... state, valueState: '{k', top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', message: 'error' }
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
    : (state: ParseValueState) => (name: string) => ParserState
    = state => name => {
    const ref = at(name)(state.module.refs)
    if (ref === null)
        return { state: 'error', message: 'const not found' }
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
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case ']':
            return state.valueState === '[,'
                ? endArray(state)
                : { state: 'error', message: 'unexpected token' }
        case 'id': return pushRef(state)(token.value)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default:
            if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
            return { state: 'error', message: 'unexpected token' }
    }
}

const parseArrayStartOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)
        case '[': return startArray(state)
        case ']': return endArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseArrayValueOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case ']': return endArray(state)
        case ',': return { ... state, valueState: '[,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

// allow identifier property names (#2410)
const parseObjectStartOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case 'string':
        case 'id':
            return pushKey(state)(String(token.value))
        case '}': return endObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseObjectKeyOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case ':': return { ... state, valueState: '{:', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseObjectColonOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    switch (token.kind)
    {
        case 'id': return pushRef(state)(token.value)
        case '[': return startArray(state)
        case '{': return startObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseObjectNextOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case ',': return { ... state, valueState: '{,', top: state.top, stack: state.stack }
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseObjectCommaOp
    : (token: DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case '}': return endObject(state)
        case 'string':
        case 'id':
            return pushKey(state)(String(token.value))
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const foldOp
    : Operator.Fold<DjsToken, ParserState>
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
        case 'error': return { state: 'error', message: state.message }
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

export const parseFromTokens = (tokenList: List<DjsToken>): result.Result<AstModule, string> => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null }})(tokenList)
    switch (state.state) {
        case 'result': return result.ok<AstModule>([ toArray(state.module.modules), toArray(state.module.consts) ])
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}
