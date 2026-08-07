/**
 * Plain-object helpers and types: the `OptionalMap`/`RequiredMap`/`StringMap`
 * record shapes and `Entry<T>`, safe property lookup via `at`, conversions
 * between entries and `OrderedMap`, and the `OneKey`/`SingleProperty`/`NotUnion`
 * utility types.
 *
 * @module
 */
import { isArray } from '../array/module.f.ts'
import { iterable, type List } from '../list/module.f.ts'
import { fromUndefined, type Nullable } from '../nullable/module.f.mjs'
import { entries as mapEntries, fromEntries as mapFromEntries, type OrderedMap } from '../ordered_map/module.f.ts'

const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

/** A record over the keys of `K`, each value possibly missing at runtime. */
export type OptionalMap<K extends string, T> = { readonly[k in K]?: T }

/**
 * A record over the keys of `K`, each value required.
 *
 * `K` has to be a finite union of string literals: `RequiredMap<string, T>` is
 * `never`, because no object can carry every string as a key. Use `StringMap<T>`
 * for an open key set — its values are optional, which is what such a key set
 * means at runtime.
 *
 * There is no known way to ask TypeScript whether `K` is finite, so the guard
 * approximates it with `string extends K`, which holds exactly when `K` is
 * `string`. Other infinite key sets are not caught: a template literal such as
 * `x-${string}` yields a template index signature instead of `never`, and its
 * reads are typed `T` while the runtime value is `undefined`. Keep `K` a union
 * of string literals.
 */
export type RequiredMap<K extends string, T> =
    string extends K
    ? never
    : { readonly[k in K]: T }

/** A record with an open key set. Every value can be missing at runtime. */
export type StringMap<T> = OptionalMap<string, T>

export type Entry<T> = readonly[string, T]

export const at: (name: string) => <T>(object: StringMap<T>) => Nullable<Exclude<T, undefined>>
    = name => object => {
        const d = getOwnPropertyDescriptor(object, name)
        return d === undefined ? null : fromUndefined(d.value)
    }

export const sort: <T>(e: List<Entry<T>>) => List<Entry<T>>
    = e => mapEntries(mapFromEntries(e))

export const fromEntries: <T>(e: List<Entry<T>>) => StringMap<T>
    = e => objectFromEntries(iterable(e))

export const fromMap: <T>(m: OrderedMap<T>) => StringMap<T>
    = m => fromEntries(mapEntries(m))

/**
 * A set of objects with a single key.
 *
 * See also
 * https://stackoverflow.com/questions/57571664/typescript-type-for-an-object-with-only-one-key-no-union-type-allowed-as-a-key
 */
export type OneKey<K extends string, V> = {
    [P in K]: (RequiredMap<P, V> & OptionalMap<Exclude<K, P>, never>) extends infer O
        ? { [Q in keyof O]: O[Q] }
        : never
}[K];

/**
 * https://stackoverflow.com/questions/61112584/typing-a-single-record-entry
 */
export type NotUnion<T, U = T> =
  T extends unknown ?
    [U] extends [T] ? T
    : never
  : never;

export type SingleProperty<T extends StringMap<never>> =
  keyof T extends NotUnion<keyof T> ? T
  : never;

export const isObject =
    (value: unknown): value is { readonly[k in string]: unknown } =>
    typeof value === 'object' && !isArray(value) && value !== null

const { values, entries } = Object

/** Returns only the defined (non-undefined) values of a partial record. */
export const definedValues =
    <T>(map: StringMap<Exclude<T, undefined>>): readonly Exclude<T, undefined>[] =>
    values(map).filter(v => v !== undefined)

export const definedEntries =
    <T>(cmd: StringMap<Exclude<T, undefined>>): readonly (readonly[string, Exclude<T, undefined>])[] =>
    entries(cmd).flatMap(([a, b]) => b === undefined ? [] : [[a, b]])
