const btree = require('../btree')
const find = require('../btree/find')
const btSet = require('../btree/set')
const { stringCmp } = require("../function/compare")
const list = require('../list')

/** @typedef {undefined | btree.Node<string>} Set */

/** @type {(value: string) => (set: Set) => boolean} */
const at = value => s => {
    if (s === undefined) { return false }
    return find.isFound(find.find(stringCmp(value))(s).first)
}

/** @type {(value: string) => (s: Set) => Set} */
const set = value => s => {
    if (s === undefined) { return [value] }
    return btSet.set(stringCmp(value))(value)(s)
}

/** @type {(s: Set) => list.List<string>} */
const values = s => s === undefined ? undefined : btree.values(s)

/** @type {(s: Set) => (value: string) => Set} */
const setOp = s => value => set(value)(s)

const fromValues = list.reduce(setOp)(undefined)

module.exports = {
    /** @readonly */
    at,
    /** @readonly */
    set,
    /** @readonly */
    values,
    /** @readonly */
    fromValues,
}
