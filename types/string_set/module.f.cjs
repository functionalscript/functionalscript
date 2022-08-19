const btTypes = require('../btree/types/module.f.cjs')
const btree = require('../btree/module.f.cjs')
const {
    find: { find, isFound },
    remove: { remove: btreeRemove },
    set: { set: btreeSet },
    /** @type {(s: StringSet) => list.List<string>} */
    values,
} = btree
const { stringCmp } = require("../function/compare/module.f.cjs")
const list = require('../list/module.f.cjs')
const { reduce } = list
const { compose: compose } = require('../function/module.f.cjs')

/** @typedef {btTypes.Tree<string>} StringSet */

/** @type {(value: string) => (set: StringSet) => boolean} */
const contains = value => s => s !== undefined && isFound(find(stringCmp(value))(s).first)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const set = value => btreeSet(stringCmp(value))(value)

const fromValues = reduce(set)(undefined)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const remove = compose(stringCmp)(btreeRemove)

module.exports = {
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
