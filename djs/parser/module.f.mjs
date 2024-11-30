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
* readonly kind: 'object'
* readonly values: Map.Map<Djs.Unknown>
* readonly key: string
* }} JsonObject
* */

/**
 * @typedef {{
* readonly kind: 'array'
* readonly values: List.List<Djs.Unknown>
* }} JsonArray
* */

/**
 * @typedef {|
* JsonObject |
* JsonArray
* } JsonStackElement
*/

/** @typedef {List.List<JsonStackElement>} JsonStack */

/**
 * @typedef {{
*  readonly status: 'module'
*  readonly stage: 'module' | '.' | 'exports' | '='
* }} StateModule
*/

/**
 * @typedef {{
*  readonly status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
*  readonly top: JsonStackElement | null
*  readonly stack: JsonStack
* }} StateParse
*/

/**
 * @typedef {{
*  readonly status: 'result'
*  readonly value: Djs.Unknown
* }} StateResult
*/

/**
 * @typedef {{
*  readonly status: 'error'
*  readonly message: string
* }} StateError
*/

/**
 * @typedef {|
* StateModule |
* StateParse |
* StateResult |
* StateError
* } DjsState
*/

/** @type {(token: tokenizerT.DjsToken) => (state: StateModule) => DjsState}} */
const parseModuleOp = token => state => {
    switch(state.stage)
    {
        case 'module':
        {
            if (token.kind === 'id' && token.value === 'module') return { status: 'module', stage: '.' }
            break;
        }
        case '.':
        {
            if (token.kind === '.') return { status: 'module', stage: 'exports' }
            break;
        }
        case 'exports':
        {
            if (token.kind === 'id' && token.value === 'exports') return { status: 'module', stage: '=' }
            break;
        }
        case '=':
        {
            if (token.kind === '=') return { status: '', top: null, stack: null }
            if (token.kind === 'ws') return state
        }
    }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(obj: JsonObject) => (key: string) => JsonObject} */
const addKeyToObject = obj => key => ({ kind: 'object', values: obj.values, key: key })

/** @type {(obj: JsonObject) => (value: Djs.Unknown) => JsonObject} */
const addValueToObject = obj => value => ({ kind: 'object', values: setReplace(obj.key)(value)(obj.values), key: '' })

/** @type {(array: JsonArray) => (value: Djs.Unknown) => JsonArray} */
const addToArray = array => value => ({ kind: 'array', values: list.concat(array.values)([value]) })

/** @type {(state: StateParse) => (key: string) => DjsState} */
const pushKey = state => value => {
    if (state.top?.kind === 'object') { return { status: '{k', top: addKeyToObject(state.top)(value), stack: state.stack } }
    return { status: 'error', message: 'error' }
}

/** @type {(state: StateParse) => (value: Djs.Unknown) => DjsState} */
const pushValue = state => value => {
    if (state.top === null) { return { status: 'result', value: value } }
    if (state.top.kind === 'array') { return { status: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { status: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: StateParse) => DjsState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
}

/** @type {(state: StateParse) => DjsState} */
const endArray = state => {
    const array = state.top !== null ? toArray(state.top.values) : null
    /** @type {StateParse} */
    const newState = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(array)
}

/** @type {(state: StateParse) => DjsState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
}

/** @type {(state: StateParse) => DjsState} */
const endObject = state => {
    const obj = state.top?.kind === 'object' ? fromMap(state.top.values) : null
    /** @type {StateParse} */
    const newState = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(obj)
}

/** @type {(token: tokenizerT.DjsToken) => Djs.Unknown} */
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

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseValueOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseArrayStartOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { status: '[,', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseObjectStartOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseObjectColonOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { status: '{,', top: state.top, stack: state.stack } }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizerT.DjsToken) => (state: StateParse) => DjsState}} */
const parseObjectCommaOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === 'ws') { return state }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {Operator.Fold<tokenizerT.DjsToken, DjsState>} */
const foldOp = token => state => {
    switch (state.status) {
        case 'module': return parseModuleOp(token)(state)
        case 'result': return { status: 'error', message: 'unexpected token' }
        case 'error': return { status: 'error', message: state.message }
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

/** @type {(tokenList: List.List<tokenizerT.DjsToken>) => Result.Result<Djs.Unknown, string>} */
const parse = tokenList => {
    const state = fold(foldOp)({ status: 'module', stage: 'module' })(tokenList)
    switch (state.status) {
        case 'result': return result.ok(state.value)
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}

export default {
    /** @readonly */
    parse
}