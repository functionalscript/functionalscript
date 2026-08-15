/**
 * The shared structural JSON parser: one tokenizer, one container state
 * machine, and a numeric policy per codec.
 *
 * The state machine builds objects and arrays; a number token is handed to the
 * `NumberPolicy` the caller supplies, together with its exact lexeme. Numeric
 * syntax therefore stays lossless all the way to the policy, and each codec
 * chooses its own runtime numeric domain from the same parse:
 *
 * ```text
 * JSON text -> tokenizer -> parse(policy) -+-> json.Unknown       (number)
 *                                          +-> extended.Unknown   (number | bigint)
 *                                          +-> another policy's domain
 * ```
 *
 * No codec has to materialize another codec's domain first: standard JSON
 * parsing never needs an intermediate `bigint`, and extended parsing never
 * needs an intermediate rounded `number`.
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Fold } from '../../../types/function/operator/types.ts'
 * @import { JsonToken } from '../tokenizer/types.ts'
 * @import { NumberPolicy, ParseUnknown, _JsonObject, _JsonArray, _StateParse, _JsonState, _JsonStack, _ValueToken } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { fold, next, toArray, concat } from '../../../types/list/module.f.mjs'
import { setReplace } from '../../../types/ordered_map/module.f.mjs'
import { fromMap } from '../../../types/object/module.f.mjs'

/**
 * Every syntax error the parser can report is the same one: a token that
 * cannot follow the state it arrived in. It carries no position or metadata,
 * so one shared value serves all of them — and no numeric policy either, so
 * the same value serves every instantiation of the parser.
 *
 * @type {_JsonState<never>}
 */
const unexpectedToken = { status: 'error', message: 'unexpected token' }

/** @type {<P>(obj: _JsonObject<P>) => (key: string) => _JsonObject<P>} */
const addKeyToObject =
    obj => key => ({ kind: 'object', values: obj.values, key: key })

/** @type {<P>(obj: _JsonObject<P>) => (value: ParseUnknown<P>) => _JsonObject<P>} */
const addValueToObject =
    obj => value => ({ kind: 'object', values: setReplace(obj.key)(value)(obj.values), key: '' })

/** @type {<P>(array: _JsonArray<P>) => (value: ParseUnknown<P>) => _JsonArray<P>} */
const addToArray =
    array => value => ({ kind: 'array', values: concat(array.values)([value]) })

/**
 * `pushKey` only ever runs while parsing the object `startObject` opened
 * (status `'{'`/`'{,'`), so `state.top` is always that object here — the same
 * construction guarantee `endArray` relies on below.
 *
 * @template P
 * @param {_StateParse<P>} state
 * @returns {(key: string) => _JsonState<P>}
 */
const pushKey = state => value => {
    const { top } = state
    assert(top !== null && top.kind === 'object', top)
    return {
        status: '{k',
        top: addKeyToObject(top)(value),
        stack: state.stack,
    }
}

/** @type {<P>(state: _StateParse<P>) => (value: ParseUnknown<P>) => _JsonState<P>} */
const pushValue = state => value => {
    if (state.top === null) { return { status: 'result', value: value } }
    if (state.top.kind === 'array') { return { status: '[v', top: addToArray(state.top)(value), stack: state.stack } }
    return { status: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
}

/** @type {<P>(state: _StateParse<P>) => _JsonState<P>} */
const startArray = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
}

/**
 * Pops the enclosing container off `stack`. `next` is forced here rather than
 * left as a `drop(1)` thunk: the stack is written only by startArray/startObject,
 * always as a literal cons, and a lazy pop would leave one unforced thunk per
 * closed container — a chain that overflows the stack when it is finally forced.
 *
 * @type {<P>(stack: _JsonStack<P>) => _StateParse<P>}
 */
const popStack = stack => {
    const ne = next(stack)
    return ne === null
        ? { status: '', top: null, stack: null }
        : { status: '', top: ne.first, stack: ne.tail }
}

/**
 * `endArray` only ever runs while parsing the array `startArray` opened
 * (status `'['`/`'[v'`), so `state.top` is always that array here.
 *
 * @template P
 * @param {_StateParse<P>} state
 * @returns {_JsonState<P>}
 */
const endArray = state => {
    const { top } = state
    assert(top !== null && top.kind === 'array', top)
    const array = toArray(top.values)
    const newState = popStack(state.stack)
    return pushValue(newState)(array)
}

/** @type {<P>(state: _StateParse<P>) => _JsonState<P>} */
const startObject = state => {
    const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
    return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
}

/**
 * `endObject` only ever runs while parsing the object `startObject` opened
 * (status `'{'`/`'{v'`), so `state.top` is always that object here.
 *
 * @template P
 * @param {_StateParse<P>} state
 * @returns {_JsonState<P>}
 */
const endObject = state => {
    const { top } = state
    assert(top !== null && top.kind === 'object', top)
    const obj = fromMap(top.values)
    const newState = popStack(state.stack)
    return pushValue(newState)(obj)
}

/**
 * Only ever called on a token `isValueToken` has already confirmed carries a
 * value, so the switch covers every `_ValueToken` case with no fallback arm.
 * A number is the one leaf the parser does not know how to build: `policy`
 * owns that decision and may reject the token.
 *
 * @type {<P>(policy: NumberPolicy<P>) => (token: _ValueToken) => Result<ParseUnknown<P>, string>}
 */
const tokenToValue = policy => token => {
    switch (token.kind) {
        case 'null': return ok(null)
        case 'false': return ok(false)
        case 'true': return ok(true)
        case 'number': return policy(token)
        case 'string': return ok(token.value)
    }
}

/** @type {<P>(policy: NumberPolicy<P>) => (state: _StateParse<P>) => (token: _ValueToken) => _JsonState<P>} */
const pushLeaf = policy => state => token => {
    const [kind, value] = tokenToValue(policy)(token)
    return kind === 'error' ? { status: 'error', message: value } : pushValue(state)(value)
}

/**
 * @param {JsonToken} token
 * @returns {token is _ValueToken}
 */
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

/** @type {<P>(policy: NumberPolicy<P>) => (token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseValueOp = policy => token => state => {
    switch (token.kind) {
        // A value is required here (top level, after `[`+`,`, or after `:`),
        // so `]` is never valid — strict JSON has no trailing commas.
        case ']':
            return unexpectedToken
        case '[': return startArray(state)
        case '{': return startObject(state)
        default:
            if (isValueToken(token)) { return pushLeaf(policy)(state)(token) }
            return unexpectedToken
    }
}

/** @type {<P>(policy: NumberPolicy<P>) => (token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseArrayStartOp = policy => token => state => {
    if (isValueToken(token)) { return pushLeaf(policy)(state)(token) }
    if (token.kind === '[') { return startArray(state) }
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === '{') { return startObject(state) }
    return unexpectedToken
}

/** @type {<P>(token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseArrayValueOp = token => state => {
    if (token.kind === ']') { return endArray(state) }
    if (token.kind === ',') { return { status: '[,', top: state.top, stack: state.stack } }
    return unexpectedToken
}

/** @type {<P>(token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseObjectStartOp = token => state => {
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    if (token.kind === '}') { return endObject(state) }
    return unexpectedToken
}

/** @type {<P>(token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseObjectKeyOp = token => state => {
    if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
    return unexpectedToken
}

/** @type {<P>(token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseObjectNextOp = token => state => {
    if (token.kind === '}') { return endObject(state) }
    if (token.kind === ',') { return { status: '{,', top: state.top, stack: state.stack } }
    return unexpectedToken
}

/** @type {<P>(token: JsonToken) => (state: _StateParse<P>) => _JsonState<P>} */
const parseObjectCommaOp = token => state => {
    // After a `,` a member (string key) is required — `}` here would be a
    // trailing comma, which strict JSON rejects.
    if (token.kind === 'string') { return pushKey(state)(token.value) }
    return unexpectedToken
}

/** @type {<P>(policy: NumberPolicy<P>) => Fold<JsonToken, _JsonState<P>>} */
const foldOp = policy => token => state => {
    if (token.kind === 'eof')
        return state

    switch (state.status) {
        case 'result': return unexpectedToken
        case 'error': return { status: 'error', message: state.message }
        case '': return parseValueOp(policy)(token)(state)
        case '[': return parseArrayStartOp(policy)(token)(state)
        case '[v': return parseArrayValueOp(token)(state)
        case '[,': return parseValueOp(policy)(token)(state)
        case '{': return parseObjectStartOp(token)(state)
        case '{k': return parseObjectKeyOp(token)(state)
        case '{:': return parseValueOp(policy)(token)(state)
        case '{v': return parseObjectNextOp(token)(state)
        case '{,': return parseObjectCommaOp(token)(state)
    }
}

/**
 * Parses a list of JSON tokens into the value domain `policy` materializes
 * numbers into.
 *
 * Returns `ok` with the parsed value on success, or `error` with a message
 * when the token sequence is invalid or incomplete — or when `policy` rejects
 * a number token that its domain cannot represent.
 *
 * @type {<P>(policy: NumberPolicy<P>) => (tokenList: List<JsonToken>) => Result<ParseUnknown<P>, string>}
 */
export const parse = policy => tokenList => {
    /** @type {_JsonState<never>} */
    const init = { status: '', top: null, stack: null }
    const state = fold(foldOp(policy))(init)(tokenList)
    switch (state.status) {
        case 'result': return ok(state.value)
        case 'error': return error(state.message)
        default: return error('unexpected end')
    }
}

