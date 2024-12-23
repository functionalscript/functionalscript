import * as BtreeTypes from '../btree/types/module.f.ts'
import * as btree from '../btree/module.f.ts'
import * as btf from '../btree/find/module.f.ts'
const { find, isFound } = btf
import * as btr from '../btree/remove/module.f.ts'
const { remove: btreeRemove } = btr
import * as bts from '../btree/set/module.f.ts'
const { set: btreeSet } = bts
import * as string from "../string/module.f.ts"
const { cmp } = string
import { fold, type List } from '../list/module.f.ts'
import * as f from '../function/module.f.ts'
const { compose } = f

export const values: (s: StringSet) => List<string> = btree.values
export const empty: null = btree.empty

export type StringSet = BtreeTypes.Tree<string>

export const contains
    : (value: string) => (set: StringSet) => boolean
    = value => {
    const f = find(cmp(value))
    return s => s !== null && isFound(f(s).first)
}

export const set
    : (value: string) => (s: StringSet) => StringSet
    = value => btreeSet(cmp(value))(() => value)

export const fromValues = fold(set)(null)

export const remove
    : (value: string) => (s: StringSet) => StringSet
    = compose(cmp)(btreeRemove)
