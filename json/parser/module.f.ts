import * as result from '../../types/result/module.f.ts'
import { type List, fold, first, drop, toArray, concat } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import type * as Tokenizer from '../tokenizer/module.f.ts'
import { setReplace, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import type * as Json from '../module.f.ts'
import { fromMap } from '../../types/object/module.f.ts'

type JsonObject = {
    readonly kind: 'object'
    readonly values: OrderedMap<Json.Unknown>
    readonly key: string
}

type JsonArray = {
    readonly kind: 'array'
    readonly values: List<Json.Unknown>
}

type JsonStackElement = |
    JsonObject |
    JsonArray

type JsonStack = List<JsonStackElement>

type StateParse = {
    readonly status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
    readonly top: JsonStackElement | null
    readonly stack: JsonStack
}

type StateResult = {
    readonly status: 'result'
    readonly value: Json.Unknown
}

type StateError = {
    readonly status: 'error'
    readonly message: string
}

type JsonState = |
    StateParse |
    StateResult |
    StateError

const addKeyToObject
    : (obj: JsonObject) => (key: string) => JsonObject
    = obj => key => ({ kind: 'object', values: obj.values, key: key })

const addValueToObject
    : (obj: JsonObject) => (value: Json.Unknown) => JsonObject
    = obj => value => ({ kind: 'object', values: setReplace(obj.key)(value)(obj.values), key: '' })

const addToArray
    : (array: JsonArray) => (value: Json.Unknown) => JsonArray
    = array => value => ({ kind: 'array', values: concat(array.values)([value]) })

const pushKey
    : (state: StateParse) => (key: string) => JsonState
    = state => value => {
        if (state.top?.kind === 'object') { return { status: '{k', top: addKeyToObject(state.top)(value), stack: state.stack } }
        return { status: 'error', message: 'error' }
    }

const pushValue
    : (state: StateParse) => (value: Json.Unknown) => JsonState
    = state => value => {
        if (state.top === null) { return { status: 'result', value: value } }
        if (state.top.kind === 'array') { return { status: '[v', top: addToArray(state.top)(value), stack: state.stack } }
        return { status: '{v', top: addValueToObject(state.top)(value), stack: state.stack }
    }

const startArray
    : (state: StateParse) => JsonState
    = state => {
        const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
        return { status: '[', top: { kind: 'array', values: null }, stack: newStack }
    }

const endArray
    : (state: StateParse) => JsonState
    = state => {
        const array = state.top !== null ? toArray(state.top.values) : null
        const newState
            : StateParse
            = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
        return pushValue(newState)(array)
    }

const startObject
    : (state: StateParse) => JsonState
    = state => {
        const newStack = state.top === null ? null : { first: state.top, tail: state.stack }
        return { status: '{', top: { kind: 'object', values: null, key: '' }, stack: newStack }
    }

const endObject
    : (state: StateParse) => JsonState
    = state => {
        const obj = state.top?.kind === 'object' ? fromMap(state.top.values) : null
        const newState
            : StateParse
            = { status: '', top: first(null)(state.stack), stack: drop(1)(state.stack) }
        return pushValue(newState)(obj)
    }

const tokenToValue
    : (token: Tokenizer.JsonToken) => Json.Unknown
    = token => {
        switch (token.kind) {
            case 'null': return null
            case 'false': return false
            case 'true': return true
            case 'number': return parseFloat(token.value)
            case 'string': return token.value
            default: return null
        }
    }

const isValueToken
    : (token: Tokenizer.JsonToken) => boolean
    = token => {
        switch (token.kind) {
            case 'null':
            case 'false':
            case 'true':
            case 'number':
            case 'string': return true
            default: return false
        }
    }

const parseValueOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        switch (token.kind) {
            case ']':
                if (state.status === '[,') { return endArray(state) }
                return { status: 'error', message: 'unexpected token' }
            case '}':
                if (state.status === '{,') { return endObject(state) }
                return { status: 'error', message: 'unexpected token' }
            case '[': return startArray(state)
            case '{': return startObject(state)
            case 'null':
            case 'false':
            case 'true':
            case 'number':
            case 'string':
                return pushValue(state)(tokenToValue(token))
            default:
                return { status: 'error', message: 'unexpected token' }
        }
    }

const parseArrayStartOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (isValueToken(token)) { return pushValue(state)(tokenToValue(token)) }
        if (token.kind === '[') { return startArray(state) }
        if (token.kind === ']') { return endArray(state) }
        if (token.kind === '{') { return startObject(state) }
        return { status: 'error', message: 'unexpected token' }
    }

const parseArrayValueOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (token.kind === ']') { return endArray(state) }
        if (token.kind === ',') { return { status: '[,', top: state.top, stack: state.stack } }
        return { status: 'error', message: 'unexpected token' }
    }

const parseObjectStartOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (token.kind === 'string') { return pushKey(state)(token.value) }
        if (token.kind === '}') { return endObject(state) }
        return { status: 'error', message: 'unexpected token' }
    }

const parseObjectKeyOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (token.kind === ':') { return { status: '{:', top: state.top, stack: state.stack } }
        return { status: 'error', message: 'unexpected token' }
    }

const parseObjectNextOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (token.kind === '}') { return endObject(state) }
        if (token.kind === ',') { return { status: '{,', top: state.top, stack: state.stack } }
        return { status: 'error', message: 'unexpected token' }
    }

const parseObjectCommaOp
    : (token: Tokenizer.JsonToken) => (state: StateParse) => JsonState
    = token => state => {
        if (token.kind === '}') { return endObject(state) }
        if (token.kind === 'string') { return pushKey(state)(token.value) }
        return { status: 'error', message: 'unexpected token' }
    }

const foldOp
    : Operator.Fold<Tokenizer.JsonToken, JsonState>
    = token => state => {
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

export const parse
    : (tokenList: List<Tokenizer.JsonToken>) => result.Result<Json.Unknown, string>
    = tokenList => {
        const state = fold(foldOp)({ status: '', top: null, stack: null })(tokenList)
        switch (state.status) {
            case 'result': return result.ok(state.value)
            case 'error': return result.error(state.message)
            default: return result.error('unexpected end')
        }
    }
