import * as list from '../list/module.f.mjs'
const { iterable } = list
import * as btMap from '../map/module.f.ts'
const { entries: mapEntries, fromEntries: mapFromEntries } = btMap
const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

export type Map<T> = {
   readonly [k in string]: T
}

export type Entry<T> = readonly[string, T]

export const at
    : (name: string) => <T>(object: Map<T>) => T|null
    = name => object => {
    const r = getOwnPropertyDescriptor(object, name)
    return r === void 0 ? null : r.value
}

export const sort
    : <T>(e: list.List<Entry<T>>) => list.List<Entry<T>>
    = e => mapEntries(mapFromEntries(e))

export const fromEntries
    : <T>(e: list.List<Entry<T>>) => Map<T>
    = e => objectFromEntries(iterable(e))

export const fromMap
    : <T>(m: btMap.Map<T>) => Map<T>
    = m => fromEntries(mapEntries(m))
