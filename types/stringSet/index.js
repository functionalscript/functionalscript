const btree = require('../btree')
const find = require('../btree/find')
const btSet = require('../btree/set')
const { stringCmp } = require("../function/compare")
const list = require('../list')
const { flip } = require('../function')

/** @typedef {undefined | btree.Node<string>} StringSet */

/** @type {(value: string) => (set: StringSet) => boolean} */
const contains = value => s => s !== undefined && find.isFound(find.find(stringCmp(value))(s).first)

/** @type {(value: string) => (s: StringSet) => StringSet} */
const set = value => s => s === undefined ? [value] : btSet.set(stringCmp(value))(value)(s)

/** @type {(s: StringSet) => list.List<string>} */
const values = s => s === undefined ? undefined : btree.values(s)

const fromValues = list.reduce(flip(set))(undefined)

module.exports = {
    /** @readonly */
    contains,
    /** @readonly */
    set,
    /** @readonly */
    values,
    /** @readonly */
    fromValues,
}
