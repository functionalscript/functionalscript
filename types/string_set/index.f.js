const btree = require('../btree/index.f.js')
const find = require('../btree/find/index.f.js')
const btSet = require('../btree/set/index.f.js')
const btRemove = require('../btree/remove/index.f.js')
const { stringCmp } = require("../function/compare/index.f.js")
const list = require('../list/index.f.js')
const { compose } = require('../function/index.f.js')

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
