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
        return r === void 0 ? null : r.value
    }

export const sort: <T>(e: List<Entry<T>>) => List<Entry<T>>
    = e => mapEntries(mapFromEntries(e))

export const fromEntries: <T>(e: List<Entry<T>>) => Map<T>
    = e => objectFromEntries(iterable(e))

export const fromMap: <T>(m: BtMap<T>) => Map<T>
    = m => fromEntries(mapEntries(m))
