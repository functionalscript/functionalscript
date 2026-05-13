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
 * Walks `types` and produces a flat list of `or` variants:
 *
 * - Variants whose thunk resolves to `['or', ...]` are inlined.
 * - Each thunk is resolved at most once; thunks reached a second time are
 *   kept as-is, so self-referential `or` schemas terminate.
 */
const flattenOr = (types: readonly Type[]): readonly Type[] => {
    const out: Type[] = []
    const visited = new Set<Type>()
    const walk = (ts: readonly Type[]): void => {
        for (const t of ts) {
            if (typeof t === 'function' && !visited.has(t)) {
                visited.add(t)
                const info = t()
                if (info[0] === 'or') {
                    walk(info.slice(1) as readonly Type[])
                    continue
                }
            }
            out.push(t)
        }
    }
    walk(types)
    return out
}

/** Reads the tag of a thunk variant once, or returns `null` for a `Const`. */
const variantTag = (t: Type): string | null =>
    typeof t === 'function' ? t()[0] as string : null

/**
 * Equality on `Type` variants used for `or` deduplication.
 *
 * - Reference equality covers thunks and object/tuple consts.
 * - `Object.is` covers primitive consts (so `NaN` and `±0` behave like
 *   `constPrimitiveValidate`).
 *
 * Deep structural equality on struct/tuple consts is intentionally out of
 * scope — see goals 1 and 3 of issue 130.
 */
const sameVariant = (a: Type, b: Type): boolean => {
    const ta = typeof a
    if (ta !== typeof b) { return false }
    // For primitive consts, use `Object.is` so `+0` and `-0` are distinct (and
    // `NaN` is equal to itself), matching `constPrimitiveValidate`. Reference
    // equality is reserved for objects/functions, where `0 === -0` would
    // otherwise spuriously collapse them.
    if (ta !== 'function' && ta !== 'object') { return Object.is(a, b) }
    return a === b
}

/**
 * Drops variants that are trivially subsumed by another variant.
 *
 * Trivial subset rules handled here:
 * - any variant ⊆ `unknown` — if `unknown` is present, the entire union is
 *   `unknown`.
 * - a primitive const ⊆ its primitive type thunk — `42 ⊆ number`,
 *   `'hi' ⊆ string`, `true ⊆ boolean`, `7n ⊆ bigint`.
 *
 * Full structural subset (tuples/structs/`or`/recursive schemas) is left to
 * a future change — see goals 1 and 3 of issue 130.
 */
const reduceOr = (types: readonly Type[]): readonly Type[] => {
    const flat = flattenOr(types)
    const primThunks = new Set<string>()
    for (const t of flat) {
        const tag = variantTag(t)
        if (tag === 'unknown') { return [unknown] }
        if (tag === 'boolean' || tag === 'number' || tag === 'string' || tag === 'bigint') {
            primThunks.add(tag)
        }
    }
    const result: Type[] = []
    for (const t of flat) {
        const tt = typeof t
        if ((tt === 'boolean' || tt === 'number' || tt === 'string' || tt === 'bigint')
            && primThunks.has(tt)) {
            continue
        }
        if (result.some(r => sameVariant(r, t))) { continue }
        result.push(t)
    }
    return result
}

/**
 * Constructs a schema that validates a value matching any of the given schemas.
 *
 * The resulting `or` is normalized at construction time:
 * - nested `or` thunks are flattened into the outer union,
 * - any `unknown` variant collapses the whole union to `unknown`,
 * - primitive consts subsumed by a matching primitive thunk are dropped
 *   (e.g. `or(42, number)` → `or(number)`),
 * - duplicate variants (by reference or `Object.is` for primitives) are
 *   deduplicated.
 *
 * See `issues/130-or-optimization.md`.
 */
export const or = <T extends readonly Type[]>(...types: T): Or<T> => {
    const reduced = reduceOr(types)
    return (() => ['or', ...reduced]) as unknown as Or<T>
}

/** Constructs a schema that validates a value matching `T` or `undefined`. */
export const option = <T extends Type>(t: T): Or<readonly[T, undefined]> =>
    or(t, undefined)

/** Schema that never matches any value — the empty union, corresponding to TypeScript's `never`. */
export const never: Or<readonly[]> = or()