const btTypes = require('../btree/types/main.f.cjs')
const btree = require('../btree/main.f.cjs')
const { find } = btree
const { stringCmp } = require("../function/compare/main.f.cjs")
const list = require('../list/main.f.cjs')
const { compose } = require('../function/main.f.cjs')

/** @typedef {btTypes.Tree<string>} StringSet */

/** @type {(value: string) => (set: StringSet) => boolean} */
const contains = value => s => s !== undefined && find.isFound(find.find(stringCmp(value))(s).first)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const set = value => btree.set.set(stringCmp(value))(value)

/** @type {(s: StringSet) => list.List<string>} */
const values = btree.values

const fromValues = list.reduce(set)(undefined)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const remove = compose(stringCmp)(btree.remove.remove)

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
