import result, * as Result from '../../types/result/module.f.mjs'
import list, * as List from '../../types/list/module.f.mjs'
const { fold, first, drop, toArray } = list
import * as Operator from '../../types/function/operator/module.f.mjs'
import * as tokenizerT from '../tokenizer/module.f.mjs'
import map, * as Map from '../../types/map/module.f.mjs'
const { setReplace } = map
import * as Djs from '../module.f.mjs'
import o from '../../types/object/module.f.mjs'
const { fromMap } = o

/**
 * @typedef {{
* readonly modules: List.List<string>
* readonly consts: List.List<DjsConst>
* }} DjsModule
* */

/** @typedef {boolean|string|number|null|bigint|DjsModuleCRef|DjsModuleARef|DjsArray|DjsObject} DjsConst */

/** @typedef {['cref', number]} DjsModuleCRef */

/** @typedef {['cref', number]} DjsModuleARef */

/** @typedef {['array', List.List<DjsConst>]} DjsArray */

/** @typedef {['object', Map.Map<DjsConst>, string]} DjsObject */

/**
 * @typedef {|
* DjsArray |
* DjsObject
* } DjsStackElement
*/

/** @typedef {List.List<DjsStackElement>} DjsStack */

/** @typedef {InitialState | ImportState | ConstState | ExportState | ParseValueState | ResultState | ErrorState} ParserState */

/**
 * @typedef {{
*  readonly state: ''
*  readonly module: DjsModule
* }} InitialState
*/

/**
 * @typedef {{
*  readonly state: 'import'
*  readonly module: DjsModule
* }} ImportState
*/

/**
 * @typedef {{
*  readonly state: 'const' | 'const+name' | 'const+name='
*  readonly module: DjsModule
* }} ConstState
*/

/**
 * @typedef {{
*  readonly state: 'export'
*  readonly module: DjsModule
* }} ExportState
*/

/**
 * @typedef {{
*  readonly state: 'constValue' | 'exportValue'
*  readonly module: DjsModule
*  readonly valueState: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
*  readonly top: DjsStackElement | null
*  readonly stack: DjsStack
* }} ParseValueState
*/

/**
 * @typedef {{
*  readonly state: 'result'
*  readonly module: DjsModule
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
    if (token.kind === 'id' && token.value === 'import') return { state: 'import', module: state.module }
    if (token.kind === 'id' && token.value === 'const') return { state: 'const', module: state.module }
    if (token.kind === 'id' && token.value === 'export') return { state: 'export', module: state.module }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ExportState) => ParserState}} */
const parseExportOp = token => state => {
    if (token.kind === 'ws') return state
    if (token.kind === 'id' && token.value === 'default') return { state: 'exportValue', module: state.module, valueState: '', top: null, stack: null }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(obj: DjsObject) => (key: string) => DjsObject} */
const addKeyToObject = obj => key => ([ 'object', obj[1], key])

/** @type {(obj: DjsObject) => (value: DjsConst) => DjsObject} */
const addValueToObject = obj => value => ([ 'object', setReplace(obj[2])(value)(obj[1]), '' ])

/** @type {(array: DjsArray) => (value: DjsConst) => DjsArray} */
const addToArray = array => value => ([ 'array', list.concat(array[1])([value]) ])

/** @type {(state: ParseValueState) => (key: string) => ParserState} */
const pushKey = state => key => {
    if (state.top?.[0] === 'object') { return { state: state.state, module: state.module, valueState: '{k', top: addKeyToObject(state.top)(key), stack: state.stack } }
    return { state: 'error', message: 'error' }
}

/** @type {(state: ParseValueState) => (value: DjsConst) => ParserState} */
const pushValue = state => value => {
    if (state.top === null) { return { state: 'result', module: state.module } }
    if (state.top?.[0] === 'array') { return { state: state.state, module: state.module, valueState: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { state: state.state, module: state.module, valueState: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: ParseValueState) => ParserState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { state: state.state, module: state.module, valueState: '[', top: ['array', null ], stack: newStack }
}

/** @type {(state: ParseValueState) => ParserState} */
const endArray = state => {
    /** @type {ParseValueState} */
    const newState = { state: state.state, module: state.module, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(state.top)
}

/** @type {(state: ParseValueState) => ParserState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { state: state.state, module: state.module, valueState: '{', top: ['object', null, ''], stack: newStack }
}

/** @type {(state: ParseValueState) => ParserState} */
const endObject = state => {
    /** @type {ParseValueState} */
    const newState = { state: state.state, module: state.module, valueState: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(state.top)
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
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseArrayStartOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { state: state.state, module: state.module, valueState: '[,', top: state.top, stack: state.stack } }
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
    if (token.kind === ':') { return { state: state.state, module: state.module, valueState: '{:', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectColonOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ParseValueState) => ParserState}} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { state: state.state, module: state.module, valueState: '{,', top: state.top, stack: state.stack } }
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
        case 'import': return { state: 'error', message: 'todo' }
        case 'const': return { state: 'error', message: 'todo' }
        case 'const+name': return { state: 'error', message: 'todo' }
        case 'const+name=': return { state: 'error', message: 'todo' }
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
    const state = fold(foldOp)({ state: '', module: { modules: null, consts: null } })(tokenList)
    switch (state.state) {
        case 'result': return result.ok(state.module)
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}

export default {
    /** @readonly */
    parse
}