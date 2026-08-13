/**
 * Internal state types for the JSON parser.
 *
 * @module
 */

import type { Unknown } from '../types.ts'
import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { List } from '../../../types/list/types.ts'
import type { JsonToken } from '../tokenizer/types.ts'

/** JSON tokens that carry a directly-usable value. */
export type _ValueToken = Extract<JsonToken, { readonly kind: 'null' | 'false' | 'true' | 'string' | 'number' }>

export type _JsonObject = {
    readonly kind: 'object'
    readonly values: OrderedMap<Unknown>
    readonly key: string
}

export type _JsonArray = {
    readonly kind: 'array'
    readonly values: List<Unknown>
}

type _JsonStackElement = |
    _JsonObject |
    _JsonArray

export type _JsonStack = List<_JsonStackElement>

export type _StateParse = {
    readonly status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
    readonly top: _JsonStackElement | null
    readonly stack: _JsonStack
}

type _StateResult = {
    readonly status: 'result'
    readonly value: Unknown
}

type _StateError = {
    readonly status: 'error'
    readonly message: string
}

export type _JsonState = |
    _StateParse |
    _StateResult |
    _StateError
