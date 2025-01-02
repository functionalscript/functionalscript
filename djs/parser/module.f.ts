import * as result from '../../types/result/module.f.ts'
import { fold, first, drop, toArray, length, concat, type List } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import type * as tokenizerT from '../tokenizer/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'
import { fromMap } from '../../types/object/module.f.ts'
import { type StringSet } from '../../types/string_set/module.f'
import { type Fs } from '../io/module.f'

export type ParserContext = {    
    readonly fs: Fs
    readonly path: string
    readonly complete: Map<DjsModule>
    readonly progress: StringSet    
}

export type DjsModule = [readonly string[], readonly DjsConst[]]

export type DjsConst = boolean|string|number|null|bigint|undefined|DjsModuleRef|DjsArray|DjsObject

type DjsModuleRef = ['aref' | 'cref', number]

type DjsArray = ['array', readonly DjsConst[]]

export type DjsObject = {
    readonly [k in string]: DjsConst
}

type DjsStackArray = ['array', List<DjsConst>]

type DjsStackObject = ['object', Map<DjsConst>, string]

type DjsStackElement = |
    DjsStackArray |
    DjsStackObject

type DjsStack = List<DjsStackElement>

type ParserState = InitialState | NewLineRequiredState | ImportState | ConstState | ExportState | ParseValueState | ResultState | ErrorState

type ModuleState = {
    readonly refs: Map<DjsModuleRef>
    readonly modules: List<string>
    readonly consts: List<DjsConst>
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
    : (token: tokenizerT.DjsToken) => (state: InitialState) => ParserState
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
    return { state: 'error', message: 'unexpected token' }
}

const parseNewLineRequiredOp
    : (token: tokenizerT.DjsToken) => (state: NewLineRequiredState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ExportState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ResultState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ConstState) => ParserState
    = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        case 'id': {
            if (at(token.value)(state.module.refs) !== null)
                return { state: 'error', message: 'duplicate id' }
            let cref
                : DjsModuleRef
                = ['cref', length(state.module.consts)]
            let refs = setReplace(token.value)(cref)(state.module.refs)
            return { ... state, state: 'const+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseConstNameOp
    : (token: tokenizerT.DjsToken) => (state: ConstState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ImportState) => ParserState
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
            let aref
                : DjsModuleRef
                = ['aref', length(state.module.modules)]
            let refs = setReplace(token.value)(aref)(state.module.refs)
            return { ... state, state: 'import+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseImportNameOp
    : (token: tokenizerT.DjsToken) => (state: ImportState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ImportState) => ParserState
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
    : (obj: DjsStackObject) => (value: DjsConst) => DjsStackObject
    = obj => value => ([ 'object', setReplace(obj[2])(value)(obj[1]), '' ])

const addToArray
    : (array: DjsStackArray) => (value: DjsConst) => DjsStackArray
    = array => value => ([ 'array', concat(array[1])([value]) ])

const pushKey
    : (state: ParseValueState) => (key: string) => ParserState
    = state => key => {
    if (state.top?.[0] === 'object') { return { ... state, valueState: '{k', top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', message: 'error' }
}

const pushValue
    : (state: ParseValueState) => (value: DjsConst) => ParserState
    = state => value => {
    if (state.top === null) {
        let consts = concat(state.module.consts)([value])
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
            : DjsArray
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
    : (token: tokenizerT.DjsToken) => DjsConst
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
    : (token: tokenizerT.DjsToken) => boolean
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
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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

const parseArrayStartOp
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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

const parseObjectStartOp
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case 'string': return pushKey(state)(token.value)
        case '}': return endObject(state)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const parseObjectKeyOp
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
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
    : (token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState
    = token => state => {
    switch (token.kind)
    {
        case 'string': return pushKey(state)(token.value)
        case 'ws':
        case 'nl':
        case '//':
        case '/*': return state
        default: return { state: 'error', message: 'unexpected token' }
    }
}

const foldOp
    : Operator.Fold<tokenizerT.DjsToken, ParserState>
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

export const parseFromTokens = (tokenList: List<tokenizerT.DjsToken>): result.Result<DjsModule, string> => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null }})(tokenList)
    switch (state.state) {
        case 'result': return result.ok<DjsModule>([ toArray(state.module.modules), toArray(state.module.consts) ])
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}