// @ts-self-types="./module.f.d.mts"
import * as BtreeTypes from '../btree/types/module.f.mjs'
import * as btree from '../btree/module.f.mjs'
import * as btf from '../btree/find/module.f.mjs'
const { find, isFound } = btf
import * as btr from '../btree/remove/module.f.mjs'
const { remove: btreeRemove } = btr
import * as bts from '../btree/set/module.f.mjs'
const { set: btreeSet } = bts
const {
    /** @type {(s: StringSet) => list.List<string>} */
    values,
    empty,
} = btree
import * as string from "../string/module.f.mjs"
const { cmp } = string
import * as list from '../list/module.f.mjs'
const { fold } = list
import * as f from '../function/module.f.mjs'
const { compose } = f

/** @typedef {BtreeTypes.Tree<string>} StringSet */

/** @type {(value: string) => (set: StringSet) => boolean} */
const contains = value => {
    const f = find(cmp(value))
    return s => s !== null && isFound(f(s).first)
}

/** @type {(value: string) => (s: StringSet) => StringSet} */
const set = value => btreeSet(cmp(value))(() => value)

const fromValues = fold(set)(null)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const remove = compose(cmp)(btreeRemove)

export default {
    /** @readonly */
    empty,
    /** @readonly */
    contains,
    /** @readonly */
    set,
    /** @readonly */
    values,
    /** @readonly */
    fromValues,
    /** @readonly */
    remove,
}
