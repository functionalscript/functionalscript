/**
 * Runtime type information (RTTI) — a type-safe schema system for describing and
 * converting TypeScript types. See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Includes } from '../array/types.ts'
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../ts/types.ts'
 * @import { Tag0, Primitive0, _Type0, Bigint, Unknown, Tag1, _MakeType1, Or, Type } from './types.ts'
 */

import { includes } from '../array/module.f.mjs'

const primitive0List = /** @type {const} */ (['bigint', 'boolean', 'number', 'string'])

/** @typedef {Assert<Equal<Primitive0, typeof primitive0List[number]>>} _Primitive0Pinned */

export const tag0List = /** @type {const} */ ([...primitive0List, 'unknown'])

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

const tag1List = /** @type {const} */ (['array', 'record'])

/** @typedef {Assert<Equal<Tag1, typeof tag1List[number]>>} _Tag1Pinned */

/** @type {Includes<string, typeof tag1List>} */
export const isTag1 = includes(tag1List)

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
 * @template {readonly Type[]} T
 * @param {T} types
 * @returns {Or<T>}
 */
export const or = (...types) =>
    () => ['or', ...types]

/**
 * Constructs a schema that validates a value matching `T` or `undefined`.
 *
 * @template {Type} T
 * @param {T} t
 * @returns {Or<readonly [T, undefined]>}
 */
export const option = t =>
    or(t, undefined)

/**
 * Schema that never matches any value — the empty union, corresponding to TypeScript's `never`.
 * @type {Or<readonly []>}
 */
export const never = or()
