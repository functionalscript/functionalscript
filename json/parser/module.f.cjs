const result = require('../../types/result/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const { fold, isEmpty, first, drop, toArray } = list
const operator = require('../../types/function/operator/module.f.cjs')
const tokenizer = require('../tokenizer/module.f.cjs')
const map = require('../../types/map/module.f.cjs')
const { entries, setReplace } = map


/**
 * @typedef {{
* readonly kind: 'object'
* readonly values: map.Map<any>
* readonly key: string
* }} JsonObject
* */

/**
 * @typedef {{
* readonly kind: 'array'
* readonly values: list.List<any>
* }} JsonArray
* */

/**
 * @typedef {|
* JsonObject |
* JsonArray
* } JsonStackElement
*/

/** @typedef {list.List<JsonStackElement>} JsonStack */

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
*  readonly value: any
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
* StateParse |
* StateResult |
* StateError
* } JsonState
*/

/** @type {(obj: JsonObject) => (key: string) => JsonObject} */
const addKeyToObject = obj => key => {  return { kind: 'object', values: obj.values, key: key } }

/** @type {(obj: JsonObject) => (value: any) => JsonObject} */
const addValueToObject = obj => value => { return { kind: 'object', values: setReplace(obj.key)(value)(obj.values), key: '' } }

/** @type {(array: JsonArray) => (value: any) => JsonArray} */
const addToArray = array => value => {  return { kind: 'array', values: list.concat(array.values)([value]) } }

/** @type {(state: StateParse) => (key: string) => JsonState} */
const pushKey = state => value => {
    if (state.top?.kind === 'object') { return { status: '{k', top: addKeyToObject(state.top)(value), stack: state.stack } }
    return { status: 'error', message: 'error' }
}

/** @type {(state: StateParse) => (value: any) => JsonState} */
const pushValue = state => value => {
    if (state.top === null) { return { status: 'result', value: value }}
    if (state.top.kind === 'array') { return { status: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { status: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: StateParse) => JsonState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
}

/** @type {(state: StateParse) => JsonState} */
const endArray = state => {
    const array = state.top !== null ? toArray(state.top.values) : null
    /** @type {StateParse} */
    const newState = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(array)
}

/** @type {(state: StateParse) => JsonState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
}

/** @type {operator.Fold<map.Entry<any>, any>} */
const foldToObjectOp = ([k, v]) => obj => { return { ...obj, [k] : v } }

/** @type {(m: map.Map<any>) => any} */
const toObject = m => {
    const e = entries(m)
    return fold(foldToObjectOp)({})(e)
}

/** @type {(state: StateParse) => JsonState} */
const endObject = state => {
    const obj = state.top?.kind === 'object' ? toObject(state.top.values) : null
    /** @type {StateParse} */
    const newState = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
    return pushValue(newState)(obj)
}

/** @type {(token: tokenizer.JsonToken) => any} */
const tokenToValue = token => {
    switch(token.kind) {
        case 'null': return null
        case 'false': return false
        case 'true': return true
        case 'number': return Number(token.value)
        case 'string': return token.value
        default: return null
    }
}

/** @type {(token: tokenizer.JsonToken) => boolean} */
const isValueToken = token => {
    switch(token.kind) {
        case 'null':
        case 'false':
        case 'true':
        case 'number':
        case 'string': return true
        default: return false
    }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseValueOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseArrayStartOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { status: '[,', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseObjectStartOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === '}') { return endObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseObjectColonOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === '{') { return startObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { status: '{,', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: tokenizer.JsonToken) => (state: StateParse) => JsonState}} */
const parseObjectCommaOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {operator.Fold<tokenizer.JsonToken, JsonState>} */
const foldOp = token => state => {
    switch(state.status) {
        case 'result': return { status: 'error', message: 'unexpected token' }
        case 'error': return { status: 'error', message: state.message }
        case '': return parseValueOp(token)(state)
        case '[': return parseArrayStartOp(token)(state)
        case '[v': return parseArrayValueOp(token)(state)
        case '[,': return parseValueOp(token)(state)
        case '{' : return parseObjectStartOp(token)(state)
        case '{k' : return parseObjectKeyOp(token)(state)
        case '{:' : return parseObjectColonOp(token)(state)
        case '{v' : return parseObjectNextOp(token)(state)
        case '{,' : return parseObjectCommaOp(token)(state)
    }
}

/** @type {(tokenList: list.List<tokenizer.JsonToken>) => result.Result<any, string>} */
const parse = tokenList => {
    const state = fold(foldOp)({ status: '', top: null, stack: null })(tokenList)
    switch(state.status) {
        case 'result': return result.ok(state.value)
        case 'error': return result.error(state.message)
        default: return result.error('unexpected end')
    }
}

module.exports = {
    /** @readonly */
    parse
}