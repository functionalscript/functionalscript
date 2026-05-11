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
import { includes, type Includes } from '../array/module.f.ts'
import type { Assert, Equal } from '../ts/module.f.ts'

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

type _Assert0 = Assert<Equal<Const, ConstObject | Primitive>>

export type ConstObject = Struct | Tuple

/** A struct schema: plain object whose values are nested `Type`s. */
export type Struct = { readonly[K in string]: Type }

/** A tuple schema: readonly array whose elements are nested `Type`s. */
export type Tuple = readonly Type[]

const primitive0List = ['bigint', 'boolean', 'number', 'string'] as const

export type Primitive0 = typeof primitive0List[number]

export const tag0List = [...primitive0List, 'unknown'] as const

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
        )
    )>>

/** The type of a nullary thunk for `Tag0`. */
type Type0<T extends Tag0> = () => Info0<T>

const type0 = <T extends Tag0>(tag: T): Type0<T> => () => [tag] as unknown as Info0<T>

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

const tag1List = ['array', 'record'] as const

export const isTag1: Includes<string, typeof tag1List> = includes(tag1List)

/** Tags for unary (one-parameter) type schemas. */
export type Tag1 = typeof tag1List[number]

/** Info tuple for a unary tag: `readonly[tag, innerType]`. */
export type Info1<K extends Tag1, T extends Type> = K extends Tag1 ? readonly[K, T] : never

/** The type of a unary thunk for `Tag1` with inner type `T`. */
export type Type1<K extends Tag1, T extends Type> = () => Info1<K, T>

type MakeType1<K extends Tag1> = <T extends Type>(t: T) => Type1<K, T>

const type1 = <K extends Tag1>(key: K): MakeType1<K> => t => () => [key, t] as unknown as Info1<K, typeof t>

/** Schema type for a readonly array with element type `T`. */
export type Array<T extends Type> = Type1<'array', T>

/** Constructs a schema that validates `readonly Ts<T>[]`. */
export const array: MakeType1<'array'> = type1('array')

/** Schema type for a record (index signature) with value type `T`. */
export type Record<T extends Type> = Type1<'record', T>

/** Constructs a schema that validates `{ readonly[K in string]: Ts<T> }`. */
export const record: MakeType1<'record'> = type1('record')

/** Schema type for a union of types `T`. */
export type Or<T extends readonly Type[]> = () => readonly['or', ...T]

/**
 * Precomputed grouping of an `or` schema's variants for fast dispatch.
 *
 * Primitive const variants (`null`, `undefined`, `boolean`, `number`, `string`,
 * `bigint`) are collected into a `Set` so consumers can match them in O(1).
 * The remaining variants (object/tuple consts and thunks) are kept in their
 * original order; consumers fall back to a linear scan for those.
 *
 * Note: `Set` uses SameValueZero, so `NaN` matches `NaN`. This is a small
 * semantic improvement over the previous `===` behavior, where `NaN` const
 * schemas would never match any value.
 */
export type OrAnalysis = {
    readonly primitives: ReadonlySet<unknown>
    readonly others: readonly Type[]
}

/**
 * Groups an `or` schema's variants into a fast-dispatch shape.
 *
 * Used by `or(...)` at construction time and also available as a fallback
 * for thunks not produced by `or` (e.g. manually constructed `or` schemas).
 */
export const analyzeOr = (types: readonly Type[]): OrAnalysis => {
    const primitives = new Set<unknown>()
    const others: Type[] = []
    for (const t of types) {
        if (typeof t === 'function' || (typeof t === 'object' && t !== null)) {
            others.push(t)
        } else {
            primitives.add(t)
        }
    }
    return { primitives, others }
}

const orAnalysisMap = new WeakMap<Function, OrAnalysis>()

/** Returns the precomputed analysis for an `or` thunk produced by `or(...)`, or `undefined`. */
export const orAnalysis = (thunk: Function): OrAnalysis | undefined =>
    orAnalysisMap.get(thunk)

/** Constructs a schema that validates a value matching any of the given schemas. */
export const or = <T extends readonly Type[]>(...types: T): Or<T> => {
    const thunk: Or<T> = () => ['or', ...types]
    orAnalysisMap.set(thunk, analyzeOr(types))
    return thunk
}

/** Constructs a schema that validates a value matching `T` or `undefined`. */
export const option = <T extends Type>(t: T): Or<readonly[T, undefined]> =>
    or(t, undefined)

/** Schema that never matches any value — the empty union, corresponding to TypeScript's `never`. */
export const never: Or<readonly[]> = or()