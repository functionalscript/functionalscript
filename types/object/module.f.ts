import { iterable, type List } from '../list/module.f.ts'
import { entries as mapEntries, fromEntries as mapFromEntries, type Map as BtMap } from '../map/module.f.ts'

const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

export type Map<T> = {
   readonly [k in string]: T
}

export type Entry<T> = readonly[string, T]

export const at: (name: string) => <T>(object: Map<T>) => T|null
    = name => object => {
        const r = getOwnPropertyDescriptor(object, name)
        return r === undefined ? null : r.value
    }

export const sort: <T>(e: List<Entry<T>>) => List<Entry<T>>
    = e => mapEntries(mapFromEntries(e))

export const fromEntries: <T>(e: List<Entry<T>>) => Map<T>
    = e => objectFromEntries(iterable(e))

export const fromMap: <T>(m: BtMap<T>) => Map<T>
    = m => fromEntries(mapEntries(m))

/**
 * A set of objects with a single key.
 *
 * See also
 * https://stackoverflow.com/questions/57571664/typescript-type-for-an-object-with-only-one-key-no-union-type-allowed-as-a-key
 */
export type OneKey<K extends string, V> = {
    [P in K]: (Record<P, V> & Partial<Record<Exclude<K, P>, never>>) extends infer O
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

export type SingleProperty<T extends Record<string, never>> =
  keyof T extends NotUnion<keyof T> ? T
  : never;
