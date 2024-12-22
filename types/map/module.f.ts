import * as BtreeTypes from '../btree/types/module.f.ts'
import * as btf from '../btree/find/module.f.ts'
const { value, find } = btf
import * as bts from '../btree/set/module.f.ts'
const { set } = bts
import * as btr from '../btree/remove/module.f.ts'
const { remove: btreeRemove } = btr
import * as bt from '../btree/module.f.ts'
const { values } = bt
import * as Compare from '../function/compare/module.f.ts'
import * as s from '../string/module.f.ts'
const { cmp } = s
import * as list from '../list/module.f.ts'
const { fold } = list
import * as Operator from '../function/operator/module.f.ts'

export type Sign = Compare.Sign

type Cmp<T> = Compare.Compare<T>

export type Entry<T> = readonly[string, T]

export type Map<T> = BtreeTypes.Tree<Entry<T>>

const keyCmp
    : (a: string) => <T>(b: Entry<T>) => Sign
    = a => ([b]) => cmp(a)(b)

export const at
    = (name: string) => <T>(map: Map<T>): T|null => {
    if (map === null) { return null }
    const result = value(find(keyCmp(name))(map).first)
    return result === null ? null : result[1]
}

const setReduceEntry
    : <T>(reduce: Operator.Reduce<T>) => (entry: Entry<T>) => (map: Map<T>) => Map<T>
    = reduce => entry =>
    set(keyCmp(entry[0]))(old => old === null ? entry : [old[0], reduce(old[1])(entry[1])])

export const setReduce
    : <T>(reduce: Operator.Reduce<T>) => (name: string) => (value: T) => (map: Map<T>) => Map<T>
    = reduce => name => value => setReduceEntry(reduce)([name, value])

const replace
    : <T>(a: T) => (b: T) => T
    = () => b => b

export const setReplace
    : (name: string) => <T>(value: T) => (map: Map<T>) => Map<T>
    = name => value => setReduceEntry(replace)([name, value])

export const entries
    : <T>(map: Map<T>) => list.List<Entry<T>>
    = values

export const fromEntries
    : <T>(entries: list.List<Entry<T>>) => Map<T>
    = fold(setReduceEntry(replace))(null)

export const remove
    : (name: string) => <T>(map: Map<T>) => Map<T>
    = name => btreeRemove(keyCmp(name))

export const empty = null
