// @ts-self-types="./module.f.d.mts"

import result, * as Result from '../../types/result/module.f.mjs'
import list, * as List from '../../types/list/module.f.mjs'
const { fold, first, drop, toArray, map: listMap, length } = list
import * as Operator from '../../types/function/operator/module.f.mjs'
import * as tokenizerT from '../tokenizer/module.f.mjs'
import map, * as Map from '../../types/map/module.f.mjs'
const { setReplace, at } = map
import o, * as O from '../../types/object/module.f.mjs'
const { fromMap } = o

/** @typedef {[readonly string[], readonly DjsConst[]] } DjsModule */

/** @typedef {boolean|string|number|null|bigint|DjsModuleRef|DjsArray|DjsObject} DjsConst */

/** @typedef {['aref' | 'cref', number]} DjsModuleRef */

/** @typedef {['array', readonly DjsConst[]]} DjsArray */

/**
 * @typedef {{
*  readonly [k in string]: DjsConst
* }} DjsObject
*/

/** @typedef {['array', List.List<DjsConst>]} DjsStackArray */

/** @typedef {['object', Map.Map<DjsConst>, string]} DjsStackObject */


/**
 * @typedef {|
* DjsStackArray |
* DjsStackObject
* } DjsStackElement
*/

/** @typedef {List.List<DjsStackElement>} DjsStack */

/** @typedef {InitialState | NewLineRequiredState | ImportState | ConstState | ExportState | ParseValueState | ResultState | ErrorState} ParserState */

/**
 * @typedef {{
*  readonly refs: Map.Map<DjsModuleRef>
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
* }} ModuleState
*/

/**
 * @typedef {{
*  readonly state: ''
*  readonly module: ModuleState
* }} InitialState
*/

/**
 * @typedef {{
*  readonly state: 'nl'
*  readonly module: ModuleState
* }} NewLineRequiredState
*/

/**
 * @typedef {{
*  readonly state: 'import' | 'import+name' | 'import+from'
*  readonly module: ModuleState
* }} ImportState
*/

/**
 * @typedef {{
*  readonly state: 'const' | 'const+name'
*  readonly module: ModuleState
* }} ConstState
*/

/**
 * @typedef {{
*  readonly state: 'export'
*  readonly module: ModuleState
* }} ExportState
*/

/**
 * @typedef {{
*  readonly state: 'constValue' | 'exportValue'
*  readonly module: ModuleState
*  readonly valueState: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
*  readonly top: DjsStackElement | null
*  readonly stack: DjsStack
* }} ParseValueState
*/

/**
 * @typedef {{
*  readonly state: 'result'
*  readonly module: ModuleState
* }} ResultState
*/

/**
 * @typedef {{
*  readonly state: 'error'
*  readonly message: string
* }} ErrorState
*/


/** @type {(token: tokenizerT.DjsToken) => (state: InitialState) => ParserState}} */
const parseInitialOp = token => state => {
    switch (token.kind)
    {
        case 'ws':
        case 'nl': return state
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

/** @type {(token: tokenizerT.DjsToken) => (state: NewLineRequiredState) => ParserState}} */
const parseNewLineRequiredOp = token => state => {
    switch (token.kind) {
        case 'ws': return state
        case 'nl': return { ... state, state: '' }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ExportState) => ParserState}} */
const parseExportOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case 'id': {
            if (token.value === 'default') return { ... state, state: 'exportValue', valueState: '', top: null, stack: null }
        }
    }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ConstState) => ParserState}} */
const parseConstOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case 'id': {
            if (map.at(token.value)(state.module.refs) !== null)
                return { state: 'error', message: 'duplicate id' }      
            /** @type {DjsModuleRef} */
            let cref = ['cref', length(state.module.consts)]
            let refs = map.setReplace(token.value)(cref)(state.module.refs)
            return { ... state, state: 'const+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ConstState) => ParserState}} */
const parseConstNameOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case '=': return { ... state, state: 'constValue', valueState: '', top: null, stack: null }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ImportState) => ParserState}} */
const parseImportOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case 'id': {
            if (map.at(token.value)(state.module.refs) !== null)
                return { state: 'error', message: 'duplicate id' }
            /** @type {DjsModuleRef} */
            let aref = ['aref', length(state.module.modules)]
            let refs = map.setReplace(token.value)(aref)(state.module.refs)
            return { ... state, state: 'import+name', module: { ...state.module, refs: refs } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ImportState) => ParserState}} */
const parseImportNameOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case 'id': {
            if (token.value === 'from') return { ... state, state: 'import+from' }
        }
    }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ImportState) => ParserState}} */
const parseImportFromOp = token => state => {
    switch (token.kind) {
        case 'ws':
        case 'nl': return state
        case 'string': {
            const modules = list.concat(state.module.modules)([token.value])
            return { ... state, state: 'nl', module: { ...state.module, modules: modules } }
        }
        default: return { state: 'error', message: 'unexpected token' }
    }
}

/** @type {(obj: DjsStackObject) => (key: string) => DjsStackObject} */
const addKeyToObject = obj => key => ([ 'object', obj[1], key])

/** @type {(obj: DjsStackObject) => (value: DjsConst) => DjsStackObject} */
const addValueToObject = obj => value => ([ 'object', setReplace(obj[2])(value)(obj[1]), '' ])

/** @type {(array: DjsStackArray) => (value: DjsConst) => DjsStackArray} */
const addToArray = array => value => ([ 'array', list.concat(array[1])([value]) ])

/** @type {(state: ParseValueState) => (key: string) => ParserState} */
const pushKey = state => key => {
    if (state.top?.[0] === 'object') { return { ... state, valueState: '{k', top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', message: 'error' }
}

/** @type {(state: ParseValueState) => (value: DjsConst) => ParserState} */
const pushValue = state => value => {
    if (state.top === null) { 
        let consts = list.concat(state.module.consts)([value])
        switch(state.state)
        {
            case 'exportValue': return { ... state, state: 'result', module: { ...state.module, consts: consts }}
            case 'constValue': return { ... state, state: 'nl', module: { ...state.module, consts: consts }}
        }
    }
    if (state.top?.[0] === 'array') { return { ... state, valueState: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { ... state, valueState: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: ParseValueState) => (name: string) => ParserState} */
const pushRef = state => name => {
    const ref = at(name)(state.module.refs)
    if (ref === null)
        return { state: 'error', message: 'const not found' }
    return pushValue(state)(ref)
}

/** @type {(state: ParseValueState) => ParserState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '[', top: ['array', null ], stack: newStack }
}

/** @type {(state: ParseValueState) => ParserState} */
const endArray = state => {
    const top = state.top;
    /** @type {ParseValueState} */
    const newState = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }    
    if (top !== null && top[0] === 'array')
    {
        /** @type {DjsArray} */
        const array =  ['array', toArray(top[1])];
        return pushValue(newState)(array)
    }
    return pushValue(newState)(null)
}

/** @type {(state: ParseValueState) => ParserState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { ... state, valueState: '{', top: ['object', null, ''], stack: newStack }
}

/** @type {(state: ParseValueState) => ParserState} */
const endObject = state => {
    const obj = state?.top !== null && state?.top[0] === 'object' ? fromMap(state.top[1]) : null;
    /** @type {ParseValueState} */
    const newState = { ... state, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(obj)
}

/** @type {(token: tokenizerT.DjsToken) => DjsConst} */
const tokenToValue = token => {
    switch (token.kind) {
        case 'null': return null
        case 'false': return false
        case 'true': return true
        case 'number': return parseFloat(token.value)
        case 'string': return token.value
        case 'bigint': return token.value
        default: return null
    }
}

/** @type {(token: tokenizerT.DjsToken) => boolean} */
const isValueToken = token => {
    switch (token.kind) {
        case 'null':
        case 'false':
        case 'true':
        case 'number':
        case 'string':
        case 'bigint': return true
        default: return false
    }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseValueOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === 'id') { return pushRef(state)(token.value) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseArrayStartOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === 'id') { return pushRef(state)(token.value) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { ... state, valueState: '[,', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectStartOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { ... state, valueState: '{:', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectColonOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === 'id') { return pushRef(state)(token.value) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { ... state, valueState: '{,', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectCommaOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {Operator.Fold<tokenizerT.DjsToken, ParserState>} */
const foldOp = token => state => {
    switch (state.state) {
        case '': return parseInitialOp(token)(state)
        case 'nl': return parseNewLineRequiredOp(token)(state)
        case 'import': return parseImportOp(token)(state)
        case 'import+name': return parseImportNameOp(token)(state)
        case 'import+from': return parseImportFromOp(token)(state)
        case 'const': return parseConstOp(token)(state)
        case 'const+name': return parseConstNameOp(token)(state)
        case 'export': return parseExportOp(token)(state)        
        case 'result': return { state: 'error', message: 'unexpected token' }
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

/** @type {(tokenList: List.List<tokenizerT.DjsToken>) => Result.Result<DjsModule, string>} */
const parse = tokenList => {
    const state = fold(foldOp)({ state: '', module: { refs: null, modules: null, consts: null }})(tokenList)
    switch (state.state) {
        case 'result': {
            return result.ok([ toArray(state.module.modules), toArray(state.module.consts) ])
        }            
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}


export default {
    /** @readonly */
    parse
}