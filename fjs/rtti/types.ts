/**
 * Type-level API for runtime type information (RTTI) — a type-safe schema
 * system for describing and converting TypeScript types.
 *
 * ## Core concepts
 *
 * A `Type` is either a `Const` (used directly as its own schema) or a `Thunk`
 * (a zero-argument function returning an `Info` descriptor). Thunks are the
 * primary building block: they enable lazy evaluation and recursive type definitions.
 *
 * ```
 * Type = Const | Thunk
 * Thunk = () => Info
 * Info = ['const', Const] | Info0<Tag0> | Info1<Tag1, Type> | InfoRest<ConstObject, Type>
 * ```
 *
 * ## Nullary schemas (no type parameter)
 *
 * `boolean`, `number`, `string`, `bigint`, `unknown` are pre-built `Thunk` values
 * that describe primitive types. Each is a `_Type0<Tag0>` — a thunk returning a
 * single-element tag tuple.
 *
 * ## Unary schemas (one type parameter)
 *
 * `array(t)` and `record(t)` construct `Thunk` values parameterized by an inner
 * `Type`. They return `Type1` thunks wrapping an `Info1` tuple.
 *
 * ## Const schemas
 *
 * Any `Primitive`, `Struct` (plain object), or `Tuple` (readonly array) can be
 * used directly as a schema — it describes exactly the shape of that value.
 * Inside a recursive `Thunk`-based definition, wrap consts with `() => ['const', c]`
 * to keep the schema uniform.
 *
 * ## Undeclared members
 *
 * A `Struct` or a `Tuple` on its own is **closed** — it admits the members it
 * declares and no others. `rest(c, r)` states the set every undeclared member
 * belongs to, and `open(c)` is `rest(c, unknown)`: any undeclared member at
 * all. See "Structs and tuples are closed" in `./README.md`.
 *
 * ## Converting to TypeScript types
 *
 * See `./ts/module.f.ts` for `Ts<T>` and the `*Ts` transformer types.
 *
 * @module
 */

import type { Assert } from '../asserts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { StringMap } from '../types/object/types.ts'
import type { tag0List } from './module.f.mjs'

/** A constant schema: a primitive literal, a struct object, or a tuple. */
export type Const =
    // JSON:
    | null
    | boolean
    | number
    | string
    // DJS:
    | undefined
    | bigint
    // Struct
    | { readonly[K in string]: Type }
    // Tuple
    | readonly Type[]

export type ConstObject = Struct | Tuple

/** A struct schema: plain object whose values are nested `Type`s. */
export type Struct = StringMap<Type>

/** A tuple schema: readonly array whose elements are nested `Type`s. */
export type Tuple = readonly Type[]

export type Primitive0 = 'bigint' | 'boolean' | 'number' | 'string'

/** Tags for nullary (zero-parameter) type schemas. */
export type Tag0 = typeof tag0List[number]

/** Info tuple for a nullary tag: `readonly[tag]`. */
export type Info0<T extends Tag0> = T extends Tag0 ? readonly[T] : never

/** Any schema: a `Const` used directly, or a `Thunk` for tag-based/recursive schemas. */
export type Type =
    | (() => (
        | readonly['const', Const]
        // Info0<Tag0>
        | readonly['bigint']
        | readonly['boolean']
        | readonly['number']
        | readonly['string']
        | readonly['unknown']
        // Info1<Tag1, Type>
        | readonly['array', Type]
        | readonly['record', Type]
        // Or
        | readonly['or', ...readonly Type[]]
        // InfoRest<ConstObject, Type>
        | readonly['rest', ConstObject, Type]
    ))
    | Const

type _AssertType = Assert<Equal<
    Type,
    | Const
    | (() => (
        | readonly['const', Const]
        | Info0<Tag0>
        | Info1<Tag1, Type>
        | readonly['or', ...readonly Type[]]
        | InfoRest<ConstObject, Type>
        )
    )>>

/** The type of a nullary thunk for `Tag0`. */
export type _Type0<T extends Tag0> = () => Info0<T>

/** Schema type for `boolean`. */
export type Boolean = _Type0<'boolean'>

/** Schema type for `number`. */
export type Number = _Type0<'number'>

/** Schema type for `string`. */
export type String = _Type0<'string'>

/** Schema type for `bigint`. */
export type Bigint = _Type0<'bigint'>

/** Schema type for any DJS value (`Primitive | UnknownRecord | UnknownArray`). */
export type Unknown = _Type0<'unknown'>

/** Tags for unary (one-parameter) type schemas. */
export type Tag1 = 'array' | 'record'

/** Info tuple for a unary tag: `readonly[tag, innerType]`. */
export type Info1<K extends Tag1, T extends Type> = K extends Tag1 ? readonly[K, T] : never

/** The type of a unary thunk for `Tag1` with inner type `T`. */
export type Type1<K extends Tag1, T extends Type> = () => Info1<K, T>

export type _MakeType1<K extends Tag1> = <const T extends Type>(t: T) => Type1<K, T>

/** Schema type for a readonly array with element type `T`. */
export type Array<T extends Type> = Type1<'array', T>

/** Schema type for a record (index signature) with value type `T`. */
export type Record<T extends Type> = Type1<'record', T>

/** Schema type for a union of types `T`. */
export type Or<T extends readonly Type[]> = () => readonly['or', ...T]

/**
 * Info tuple for a container with a stated rest: `readonly[tag, container,
 * rest]`, where `rest` is the set every member the container does not declare
 * belongs to. A bare `C` is the same set with a rest of `never`, and needs no
 * spelling of its own.
 */
export type InfoRest<C extends ConstObject, R extends Type> = readonly['rest', C, R]

/**
 * Schema type for a container `C` whose undeclared members are `R`. Both
 * parameters are required: `never` — the bare `C` — is the identity a schema
 * writes by leaving the wrapper off, so there is no default to state.
 */
export type Rest<C extends ConstObject, R extends Type> = () => InfoRest<C, R>

export type _MakeRest =
    <const C extends ConstObject, const R extends Type>(c: C, r: R) => Rest<C, R>

/**
 * `open`'s signature. It is not `_MakeRest` partially applied: the `const`
 * modifier is what keeps `open([42])` a literal tuple rather than widening it
 * to `Type[]`, so the modifier has to be restated here. `../proof.f.mjs` pins
 * that, as it does for every other `const`-taking constructor.
 */
export type _MakeOpen =
    <const C extends ConstObject>(c: C) => Rest<C, Unknown>
