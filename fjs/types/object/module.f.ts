/**
 * Plain-object helpers and types: the `Map<T>`/`StringMap<K, T>`/`Entry<T>`
 * shapes, safe property lookup via `at`, conversions between entries and
 * `OrderedMap`, and the `OneKey`/`SingleProperty`/`NotUnion` utility types.
 *
 * @module
 */
import { isArray } from '../array/module.f.ts'
import { iterable, type List } from '../list/module.f.ts'
import { fromUndefined, type Nullable } from '../nullable/module.f.ts'
import { entries as mapEntries, fromEntries as mapFromEntries, type OrderedMap } from '../ordered_map/module.f.ts'

const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

/** A record with an open key set. Every value can be missing at runtime. */
export type Map<T> = { readonly[k in string]?: T }

/**
 * A record with a finite key set. Every key of `K` is required.
 *
 * `K` has to be a union of string literals: `StringMap<string, T>` is `never`,
 * so an open key set is a compilation error here. Use `Map<T>` for that case —
 * its values are optional, which is what an open key set means at runtime.
 */
export type StringMap<K extends string, T> =
    string extends K
    ? never
    : { readonly[k in K]: T }

export type Entry<T> = readonly[string, T]

export const at: (name: string) => <T>(object: Map<T>) => Nullable<Exclude<T, undefined>>
    = name => object => {
        const d = getOwnPropertyDescriptor(object, name)
        return d === undefined ? null : fromUndefined(d.value)
    }

export const sort: <T>(e: List<Entry<T>>) => List<Entry<T>>
    = e => mapEntries(mapFromEntries(e))

export const fromEntries: <T>(e: List<Entry<T>>) => Map<T>
    = e => objectFromEntries(iterable(e))

export const fromMap: <T>(m: OrderedMap<T>) => Map<T>
    = m => fromEntries(mapEntries(m))

/**
 * A set of objects with a single key.
 *
 * See also
 * https://stackoverflow.com/questions/57571664/typescript-type-for-an-object-with-only-one-key-no-union-type-allowed-as-a-key
 */
export type OneKey<K extends string, V> = {
    [P in K]: (StringMap<P, V> & Partial<StringMap<Exclude<K, P>, never>>) extends infer O
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

export type SingleProperty<T extends Map<never>> =
  keyof T extends NotUnion<keyof T> ? T
  : never;

export const isObject =
    (value: unknown): value is { readonly[k in string]: unknown } =>
    typeof value === 'object' && !isArray(value) && value !== null

const { values, entries } = Object

/** Returns only the defined (non-undefined) values of a partial record. */
export const definedValues =
    <T>(map: Map<Exclude<T, undefined>>): readonly Exclude<T, undefined>[] =>
    values(map).filter(v => v !== undefined)

export const definedEntries =
    <T>(cmd: Map<Exclude<T, undefined>>): readonly (readonly[string, Exclude<T, undefined>])[] =>
    entries(cmd).flatMap(([a, b]) => b === undefined ? [] : [[a, b]])
