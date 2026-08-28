/**
 * Runtime type information (RTTI) — a type-safe schema system for describing and
 * converting TypeScript types. See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Includes } from '../types/array/types.ts'
 * @import { Tag0, _Type0, Bigint, Unknown, Tag1, _MakeType1, _MakeOpen, _MakeRest, Or, Type } from './types.ts'
 */

import { includes } from '../types/array/module.f.mjs'

export const _primitive0List = /** @type {const} */ (['bigint', 'boolean', 'number', 'string'])

export const tag0List = /** @type {const} */ ([..._primitive0List, 'unknown'])

const type0 =
    /**
     * @template {Tag0} T
     * @param {T} tag
     * @returns {_Type0<T>}
     */
    tag => () => /** @type {any} */ ([tag])

/**
 * Schema that validates `boolean` values.
 */
export const boolean = type0('boolean')

/**
 * Schema that validates `number` values.
 */
export const number = type0('number')

/**
 * Schema that validates `string` values.
 */
export const string = type0('string')

/**
 * Schema that validates `bigint` values.
 * @type {Bigint}
 */
export const bigint = type0('bigint')

/**
 * Schema that validates any DJS-compatible value.
 * @type {Unknown}
 */
export const unknown = type0('unknown')

export const _tag1List = /** @type {const} */ (['array', 'record'])

/** @type {Includes<string, typeof _tag1List>} */
export const isTag1 = includes(_tag1List)

const type1 =
    /**
     * @template {Tag1} K
     * @param {K} key
     * @returns {_MakeType1<K>}
     */
    key => t => () => /** @type {any} */ ([key, t])

/**
 * Constructs a schema that validates `readonly Ts<T>[]`.
 * @type {_MakeType1<'array'>}
 */
export const array = type1('array')

/**
 * Constructs a schema that validates `{ readonly[K in string]: Ts<T> }`.
 * @type {_MakeType1<'record'>}
 */
export const record = type1('record')

/**
 * Constructs a schema that validates a value matching any of the given schemas.
 *
 * `or` is intentionally a lazy, allocation-free constructor: it captures its
 * arguments in a thunk and does no flattening, deduplication, subset analysis,
 * or canonical-form work. All such algebra lives on the serializable data form
 * — see `./data/README.md`.
 *
 * @template {readonly Type[]} const T
 * @param {T} types
 * @returns {Or<T>}
 */
export const or = (...types) =>
    () => ['or', ...types]

/**
 * Constructs a schema that validates a value matching `T` or `undefined`.
 *
 * @template {Type} const T
 * @param {T} t
 * @returns {Or<readonly [T, undefined]>}
 */
export const option = t =>
    or(t, undefined)

/**
 * Schema that never matches any value — the empty union, corresponding to TypeScript's `never`.
 *
 * @type {Or<readonly []>}
 */
export const never = or()

/**
 * Constructs a schema for a container whose **undeclared** members belong to
 * `r`: the members `c` declares, plus any number of members belonging to `r`.
 *
 * A `Struct` or a `Tuple` used on its own is closed — it admits the members it
 * declares and no others — which is `rest(c, never)` and needs no spelling.
 * This is how a schema says it wants anything else.
 *
 * ```js
 * rest([number], string)       // one number, then any number of strings
 * rest({ a: number }, string)  // `a`, plus any number of string-valued keys
 * open({ a: number })          // `a`, plus anything else
 * ```
 *
 * Both parameters are required. An optional one would need a sentinel for "no
 * undeclared member", and every candidate — `undefined` most of all — is a
 * `Type` in its own right, so the sentinel would collide with the schema it
 * spells. `never` carries no such ambiguity, and a container whose undeclared
 * members must be the *value* `undefined` states that rest as a wrapped const,
 * `() => ['const', undefined]`.
 *
 * On the array kind `r` constrains the members past the prefix, and a `r` that
 * admits nothing bounds the array's length — which is what the bare form
 * already says, so `rest(c, never)` and `c` are one set.
 *
 * @type {_MakeRest}
 */
export const rest = (c, r) => () => /** @type {any} */ (['rest', c, r])

/**
 * Constructs a schema for an **open** container: the members `c` declares,
 * plus any number of members of any kind. `open(c)` is `rest(c, unknown)`.
 *
 * Openness is what makes a schema forward-compatible with a serialization
 * format that has grown fields, so a schema read against a wire format
 * someone else may extend says `open`.
 *
 * ```js
 * open({ a: number })   // any object whose `a` is a number
 * open([number])        // any array whose position 0 is a number
 * ```
 *
 * @type {_MakeOpen}
 */
export const open = c => /** @type {any} */ (rest(c, unknown))
