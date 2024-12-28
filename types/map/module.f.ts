import type { Tree } from '../btree/types/module.f.ts'
import { value, find } from '../btree/find/module.f.ts'
import { set } from '../btree/set/module.f.ts'
import { remove as btreeRemove } from '../btree/remove/module.f.ts'
import { values } from '../btree/module.f.ts'
import type { Sign } from '../function/compare/module.f.ts'
import { cmp } from '../string/module.f.ts'
import { fold, type List } from '../list/module.f.ts'
import type { Reduce } from '../function/operator/module.f.ts'

export type Entry<T> = readonly [string, T]

export type Map<T> = Tree<Entry<T>>

const keyCmp: (a: string) => <T>(b: Entry<T>) => Sign
    = a => ([b]) => cmp(a)(b)

export const at
    = (name: string) => <T>(map: Map<T>): T | null => {
        if (map === null) { return null }
        const result = value(find(keyCmp(name))(map).first)
        return result === null ? null : result[1]
    }

const setReduceEntry
    : <T>(reduce: Reduce<T>) => (entry: Entry<T>) => (map: Map<T>) => Map<T>
    = reduce => entry =>
        set(keyCmp(entry[0]))(old => old === null ? entry : [old[0], reduce(old[1])(entry[1])])

export const setReduce
    : <T>(reduce: Reduce<T>) => (name: string) => (value: T) => (map: Map<T>) => Map<T>
    = reduce => name => value => setReduceEntry(reduce)([name, value])

const replace
    : <T>(a: T) => (b: T) => T
    = () => b => b

export const setReplace
    : (name: string) => <T>(value: T) => (map: Map<T>) => Map<T>
    = name => value => setReduceEntry(replace)([name, value])

export const entries
    : <T>(map: Map<T>) => List<Entry<T>>
    = values

export const fromEntries
    : <T>(entries: List<Entry<T>>) => Map<T>
    = fold(setReduceEntry(replace))(null)

export const remove
    : (name: string) => <T>(map: Map<T>) => Map<T>
    = name => btreeRemove(keyCmp(name))

export const empty = null
