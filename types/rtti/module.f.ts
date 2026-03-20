/**
 * Runtime type information (RTTI) — a type-safe schema system for describing and
 * converting TypeScript types.
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
 * Info = ['const', Const] | Info0<Tag0> | Info1<Tag1, Type>
 * ```
 *
 * ## Nullary schemas (no type parameter)
 *
 * `boolean`, `number`, `string`, `bigint`, `unknown` are pre-built `Thunk` values
 * that describe primitive types. Each is a `Type0<Tag0>` — a thunk returning a
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
 * ## Converting to TypeScript types
 *
 * See `./ts/module.f.ts` for `Ts<T>` and the `*Ts` transformer types.
 */
import type { Primitive } from '../../djs/module.f.ts'

/** A constant schema: a primitive literal, a struct object, or a tuple. */
export type Const = Primitive | Struct | Tuple

/** A struct schema: plain object whose values are nested `Type`s. */
export type Struct = { readonly[K in string]: Type }

/** A tuple schema: readonly array whose elements are nested `Type`s. */
export type Tuple = readonly Type[]

/** Tags for nullary (zero-parameter) type schemas. */
export type Tag0 =
    | 'boolean'
    | 'number'
    | 'string'
    | 'bigint'
    | 'unknown'

/** Info tuple for a nullary tag: `readonly[tag]`. */
export type Info0<T extends Tag0> = readonly[T]

/**
 * The descriptor returned by a `Thunk`. One of:
 * - `['const', Const]` — a constant/literal schema (used in recursive thunks)
 * - `Info0<Tag0>` — a nullary primitive tag
 * - `Info1<Tag1, Type>` — a unary parametric tag with an inner type
 */
export type Info =
    | readonly['const', Const]
    | Info0<Tag0>
    | Info1<Tag1, Type>

/** A lazy schema: a zero-argument function returning an `Info` descriptor. */
export type Thunk = () => Info

/** Any schema: a `Const` used directly, or a `Thunk` for tag-based/recursive schemas. */
export type Type =
    | Const
    | Thunk

/** The type of a nullary thunk for `Tag0`. */
type Type0<T extends Tag0> = () => Info0<T>

const type0 = <T extends Tag0>(tag: T): Type0<T> => () => [tag]

/** Schema type for `boolean`. */
export type Boolean = Type0<'boolean'>

/** Schema that validates `boolean` values. */
export const boolean: Boolean = type0('boolean')

/** Schema type for `number`. */
export type Number = Type0<'number'>

/** Schema that validates `number` values. */
export const number: Number = type0('number')

/** Schema type for `string`. */
export type String = Type0<'string'>

/** Schema that validates `string` values. */
export const string: String = type0('string')

/** Schema type for `bigint`. */
export type Bigint = Type0<'bigint'>

/** Schema that validates `bigint` values. */
export const bigint: Bigint = type0('bigint')

/** Schema type for any DJS value (`Primitive | UnknownRecord | UnknownArray`). */
export type Unknown = Type0<'unknown'>

/** Schema that validates any DJS-compatible value. */
export const unknown: Unknown = type0('unknown')

/** Tags for unary (one-parameter) type schemas. */
export type Tag1 = 'array' | 'record'

/** Info tuple for a unary tag: `readonly[tag, innerType]`. */
export type Info1<K extends Tag1, T extends Type> = readonly[K, T]

/** The type of a unary thunk for `Tag1` with inner type `T`. */
type Type1<K extends Tag1, T extends Type> = () => Info1<K, T>

type MakeType1<K extends Tag1> = <T extends Type>(t: T) => Type1<K, T>

const type1 = <K extends Tag1>(key: K): MakeType1<K> => t => () => [key, t]

/** Schema type for a readonly array with element type `T`. */
export type Array<T extends Type> = Type1<'array', T>

/** Constructs a schema that validates `readonly Ts<T>[]`. */
export const array: MakeType1<'array'> = type1('array')

/** Schema type for a record (index signature) with value type `T`. */
export type Record<T extends Type> = Type1<'record', T>

/** Constructs a schema that validates `{ readonly[K in string]: Ts<T> }`. */
export const record: MakeType1<'record'> = type1('record')
