/**
 * Plain-object helpers and types: `Map<T>`/`Entry<T>` shapes, safe property
 * lookup via `at`, conversions between entries and `OrderedMap`, and the
 * `OneKey`/`SingleProperty`/`NotUnion` utility types.
 *
 * @module
 */
import { isArray } from '../array/module.f.ts'
import { iterable, type List } from '../list/module.f.ts'
import { fromUndefined, type Nullable } from '../nullable/module.f.ts'
import { entries as mapEntries, fromEntries as mapFromEntries, type OrderedMap } from '../ordered_map/module.f.ts'

const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

export type Map<T> = {
   readonly [k in string]: T
}

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
    [P in K]: (ReadonlyRecord<P, V> & Partial<ReadonlyRecord<Exclude<K, P>, never>>) extends infer O
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

export type SingleProperty<T extends ReadonlyRecord<string, never>> =
  keyof T extends NotUnion<keyof T> ? T
  : never;

export const isObject =
    (value: unknown): value is { readonly[k in string]: unknown } =>
    typeof value === 'object' && !isArray(value) && value !== null

export type ReadonlyRecord<S extends string, T> = { readonly[K in S]: T }

const { values } = Object

/** Returns only the defined (non-undefined) values of a partial record. */
export const definedValues =
    <T>(cmd: { readonly[k in string]?: Exclude<T, undefined>}): readonly Exclude<T, undefined>[] =>
    values(cmd).filter(v => v !== undefined)
