import type * as BtreeTypes from '../btree/types/module.f.ts'
import * as btree from '../btree/module.f.ts'
import { find, isFound } from '../btree/find/module.f.ts'
import { remove as btreeRemove } from '../btree/remove/module.f.ts'
import { set as btreeSet } from '../btree/set/module.f.ts'
import { cmp } from "../string/module.f.ts"
import { fold, type List } from '../list/module.f.ts'
import { compose } from '../function/module.f.ts'

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

export const fromValues
: (input: List<string>) => StringSet
= fold(set)(null)

export const remove
: (value: string) => (s: StringSet) => StringSet
= compose(cmp)(btreeRemove)
