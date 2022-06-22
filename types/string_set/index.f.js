const btTypes = require('../btree/types/f.js')
const btree = require('../btree/index.f.js')
const { find } = btree
const { stringCmp } = require("../function/compare/index.f.js")
const list = require('../list/index.f.js')
const { compose } = require('../function/index.f.js')

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
