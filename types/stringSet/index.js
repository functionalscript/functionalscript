const btree = require('../btree/index.js')
const find = require('../btree/find/index.js')
const btSet = require('../btree/set/index.js')
const btRemove = require('../btree/remove/index.js')
const { stringCmp } = require("../function/compare/index.js")
const list = require('../list/index.js')
const { compose } = require('../function/index.js')

/** @typedef {btree.Tree<string>} StringSet */

/** @type {(value: string) => (set: StringSet) => boolean} */
const contains = value => s => s !== undefined && find.isFound(find.find(stringCmp(value))(s).first)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const set = value => btSet.set(stringCmp(value))(value)

/** @type {(s: StringSet) => list.List<string>} */
const values = btree.values

const fromValues = list.reduce(set)(undefined)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const remove = compose(stringCmp)(btRemove.remove)

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
