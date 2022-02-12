const btree = require('../btree')
const find = require('../btree/find')
const btSet = require('../btree/set')
const btRemove = require('../btree/remove')
const { stringCmp } = require("../function/compare")
const list = require('../list')
const { compose } = require('../function')

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
