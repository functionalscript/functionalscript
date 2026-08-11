/**
 * JSON parser that consumes tokenizer output into JSON values.
 *
 * @module
 */

/** @import { Result } from '../../../types/result/types.ts' */
import { error, ok } from '../../../types/result/module.f.mjs'
/** @import { List } from '../../../types/list/types.ts' */
import { fold, next, toArray, concat } from '../../../types/list/module.f.mjs'
/** @import { Fold } from '../../../types/function/operator/types.ts' */
/** @import { JsonToken } from '../tokenizer/types.ts' */
import { setReplace } from '../../../types/ordered_map/module.f.mjs'
/** @import { OrderedMap } from '../../../types/ordered_map/types.ts' */
/** @import { Unknown } from '../types.ts' */
import { fromMap } from '../../../types/object/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

/**
 * @typedef {{
 *     readonly kind: 'object'
 *     readonly values: OrderedMap<Unknown>
 *     readonly key: string
 * }} JsonObject
 */

/**
 * @typedef {{
 *     readonly kind: 'array'
 *     readonly values: List<Unknown>
 * }} JsonArray
 */

/** @typedef {JsonObject | JsonArray} JsonStackElement */

/** @typedef {List<JsonStackElement>} JsonStack */

/**
 * @typedef {{
 *     readonly status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
 *     readonly top: JsonStackElement | null
 *     readonly stack: JsonStack
 * }} StateParse
 */

/**
 * @typedef {{
 *     readonly status: 'result'
 *     readonly value: Unknown
 * }} StateResult
 */

/**
 * @typedef {{
 *     readonly status: 'error'
 *     readonly message: string
 * }} StateError
 */

/** @typedef {StateParse | StateResult | StateError} JsonState */

/** @type {(obj: JsonObject) => (key: string) => JsonObject} */
const addKeyToObject = obj => key => ({ kind: 'object', values: obj.values, key: key })

/** @type {(obj: JsonObject) => (value: Unknown) => JsonObject} */
const addValueToObject = obj => value => ({ kind: 'object', values: setReplace(obj.key)(value)(obj.values), key: '' })

/** @type {(array: JsonArray) => (value: Unknown) => JsonArray} */
const addToArray = array => value => ({ kind: 'array', values: concat(array.values)([value]) })

/** @type {(state: StateParse) => (key: string) => JsonState} */
const pushKey = state => value => {
    if (state.top?.kind === 'object') { return { status: '{k', top: addKeyToObject(state.top)(value), stack: state.stack } }
    return { status: 'error', message: 'error' }
}

/** @type {(state: StateParse) => (value: Unknown) => JsonState} */
const pushValue = state => value => {
    if (state.top === null) { return { status: 'result', value: value } }
    if (state.top.kind === 'array') { return { status: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { status: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {(state: StateParse) => JsonState} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
}

// Pops the enclosing container off `stack`. `next` is forced here rather than
// left as a `drop(1)` thunk: the stack is written only by startArray/startObject,
// always as a literal cons, and a lazy pop would leave one unforced thunk per
// closed container — a chain that overflows the stack when it is finally forced.
/** @type {(stack: JsonStack) => StateParse} */
const popStack = stack => {
    const ne = next(stack)
    return ne === null
        ? { status: '', top: null, stack: null }
        : { status: '', top: ne.first, stack: ne.tail }
}

/** @type {(state: StateParse) => JsonState} */
const endArray = state => {
    const array = state.top !== null ? toArray(state.top.values) : null
    const newState = popStack(state.stack)
    return pushValue(newState)(array)
}

/** @type {(state: StateParse) => JsonState} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
}

/** @type {(state: StateParse) => JsonState} */
const endObject = state => {
    const obj = state.top?.kind === 'object' ? fromMap(state.top.values) : null
    const newState = popStack(state.stack)
    return pushValue(newState)(obj)
}

/** @type {(token: JsonToken) => Unknown} */
const tokenToValue = token => {
    switch (token.kind) {
        case 'null': return null
        case 'false': return false
        case 'true': return true
        case 'number': return parseFloat(token.value)
        case 'string': return token.value
        default: return null
    }
}

/** @type {(token: JsonToken) => boolean} */
const isValueToken = token => {
    switch (token.kind) {
        case 'null':
        case 'false':
        case 'true':
        case 'number':
        case 'string': return true
        default: return false
    }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseValueOp = token => state => {
    switch (token.kind) {
        // A value is required here (top level, after `[`+`,`, or after `:`),
        // so `]` is never valid — strict JSON has no trailing commas.
        case ']':
            return { status: 'error', message: 'unexpected token' }
        case '[': return startArray(state)
        case '{': return startObject(state)
        default:
            if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
            return { status: 'error', message: 'unexpected token' }
    }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseArrayStartOp = token => state => {
    if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { status: '[,', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseObjectStartOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === '}') { return endObject(state) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { status: '{,', top: state.top, stack: state.stack } }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {(token: JsonToken) => (state: StateParse) => JsonState} */
const parseObjectCommaOp = token => state => {
    // After a `,` a member (string key) is required — `}` here would be a
    // trailing comma, which strict JSON rejects.
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    return { status: 'error', message: 'unexpected token' }
}

/** @type {Fold<JsonToken, JsonState>} */
const foldOp = token => state => {
    if (token.kind === 'eof')
        return state

    switch (state.status) {
        case 'result': return { status: 'error', message: 'unexpected token' }
        case 'error': return { status: 'error', message: state.message }
        case '': return parseValueOp(token)(state)
        case '[': return parseArrayStartOp(token)(state)
        case '[v': return parseArrayValueOp(token)(state)
        case '[,': return parseValueOp(token)(state)
        case '{': return parseObjectStartOp(token)(state)
        case '{k': return parseObjectKeyOp(token)(state)
        case '{:': return parseValueOp(token)(state)
        case '{v': return parseObjectNextOp(token)(state)
        case '{,': return parseObjectCommaOp(token)(state)
    }
}

/**
 * Parses a list of JSON tokens into a JSON-compatible value.
 *
 * Returns `ok` with the parsed value on success, or `error` with a message
 * when the token sequence is invalid or incomplete.
 *
 * @type {(tokenList: List<JsonToken>) => Result<Unknown, string>}
 */
export const parse = tokenList => {
    const state = fold(foldOp)({ status: '', top: null, stack: null })(tokenList)
    switch (state.status) {
        case 'result': return ok(state.value)
        case 'error': return error(state.message)
        default: return error('unexpected end')
    }
}

export const proof = {
    pushKey: {
        // `pushKey` is only ever invoked while `state.top` is an object (the
        // state machine's `'{'`/`'{,'` statuses guarantee it), so its
        // non-object guard is a defensive branch unreachable through `parse`.
        // Call it directly to cover that branch.
        nonObjectTop: () => {
            /** @type {StateParse} */
            const state = { status: '[', top: { kind: 'array', values: null }, stack: null }
            const result = pushKey(state)('key')
            assertEq(result.status, 'error')
        },
    },
}
