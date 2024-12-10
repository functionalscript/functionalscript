import result, * as Result from '../../types/result/module.f.mjs'
import list, * as List from '../../types/list/module.f.mjs'
const { fold, first, drop, toArray, flat, map: listMap } = list
import * as Operator from '../../types/function/operator/module.f.mjs'
import * as tokenizerT from '../tokenizer/module.f.mjs'
import map, * as Map from '../../types/map/module.f.mjs'
const { setReplace } = map
import o, * as O from '../../types/object/module.f.mjs'
const { fromMap } = o

/** @typedef {O.Entry<DjsConst>} Entry*/

/** @typedef {(List.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @typedef {[readonly string[], readonly DjsConst[]] } DjsModule */

/** @typedef {boolean|string|number|null|bigint|DjsModuleCRef|DjsModuleARef|DjsArray|DjsObject} DjsConst */

/** @typedef {['cref', number]} DjsModuleCRef */

/** @typedef {['cref', number]} DjsModuleARef */

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

/** @typedef {InitialState | ImportState | ConstState | ExportState | ParseValueState | ResultState | ErrorState} ParserState */

/**
 * @typedef {{
*  readonly state: ''
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
* }} InitialState
*/

/**
 * @typedef {{
*  readonly state: 'import'
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
* }} ImportState
*/

/**
 * @typedef {{
*  readonly state: 'const' | 'const+name' | 'const+name='
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
* }} ConstState
*/

/**
 * @typedef {{
*  readonly state: 'export'
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
* }} ExportState
*/

/**
 * @typedef {{
*  readonly state: 'constValue' | 'exportValue'
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
*  readonly valueState: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
*  readonly top: DjsStackElement | null
*  readonly stack: DjsStack
* }} ParseValueState
*/

/**
 * @typedef {{
*  readonly state: 'result'
*  readonly modules: List.List<string>
*  readonly consts: List.List<DjsConst>
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
    if (token.kind === 'id' && token.value === 'import') return { ... state, state: 'import' }
    if (token.kind === 'id' && token.value === 'const') return { ... state, state: 'const' }
    if (token.kind === 'id' && token.value === 'export') return { ... state, state: 'export' }
    return { state: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: ExportState) => ParserState}} */
const parseExportOp = token => state => {
    if (token.kind === 'ws') return state
    if (token.kind === 'id' && token.value === 'default') return { ... state, state: 'exportValue', valueState: '', top: null, stack: null }
    return { state: 'error', message: 'unexpected token' }
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
    if (state.top === null) { return { ... state, state: 'result' } }
    if (state.top?.[0] === 'array') { return { ... state, valueState: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { ... state, valueState: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
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
    const state = fold(foldOp)({ state: '', modules: null, consts: null })(tokenList)
    switch (state.state) {
        case 'result': {
            return result.ok([ toArray(state.modules), toArray(state.consts) ])
        }            
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}


export default {
    /** @readonly */
    parse
}