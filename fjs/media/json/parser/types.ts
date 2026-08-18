/**
 * Types for the shared structural JSON parser: its numeric policy, the tree
 * that policy produces, and the parser's internal state.
 *
 * @module
 */

import type { Tree } from '../types.ts'
import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { List } from '../../../types/list/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { JsonToken } from '../tokenizer/types.ts'
import type { NumberToken } from '../../../js/tokenizer/types.ts'

/** JSON tokens that carry a directly-usable value. */
export type _ValueToken = Extract<JsonToken, { readonly kind: 'null' | 'false' | 'true' | 'string' | 'number' }>

/**
 * A numeric policy: how one codec materializes a JSON number token into its
 * own numeric domain `P`.
 *
 * The policy is handed the token itself, so it decides from the exact lexeme —
 * before any narrowing the parser might otherwise have imposed. It may fail:
 * a valid JSON number can be outside the domain the codec offers (the extended
 * codec has no non-finite `number`), and that has to be an ordinary parse
 * error rather than an escaping runtime exception.
 */
export type NumberPolicy<P> = (token: NumberToken) => Result<P, string>

/**
 * The tree a numeric policy `P` parses into: JSON's containers over `P` plus
 * the primitives every policy shares.
 */
export type ParseUnknown<P> = Tree<P | null | boolean | string>

export type _JsonObject<P> = {
    readonly kind: 'object'
    readonly values: OrderedMap<ParseUnknown<P>>
    readonly key: string
}

export type _JsonArray<P> = {
    readonly kind: 'array'
    readonly values: List<ParseUnknown<P>>
}

type _JsonStackElement<P> = |
    _JsonObject<P> |
    _JsonArray<P>

export type _JsonStack<P> = List<_JsonStackElement<P>>

export type _StateParse<P> = {
    readonly status: '' | '[' | '[v' | '[,' | '{' | '{k' | '{:' | '{v' | '{,'
    readonly top: _JsonStackElement<P> | null
    readonly stack: _JsonStack<P>
}

type _StateResult<P> = {
    readonly status: 'result'
    readonly value: ParseUnknown<P>
}

type _StateError = {
    readonly status: 'error'
    readonly message: string
}

export type _JsonState<P> = |
    _StateParse<P> |
    _StateResult<P> |
    _StateError
