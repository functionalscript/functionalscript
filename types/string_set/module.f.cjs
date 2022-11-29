const btTypes = require('../btree/types/module.f.cjs')
const btree = require('../btree/module.f.cjs')
const {
    find: { find, isFound },
    remove: { remove: btreeRemove },
    set: { set: btreeSet },
    /** @type {(s: StringSet) => list.List<string>} */
    values,
    empty,
} = btree
const { cmp } = require("../string/module.f.cjs")
const list = require('../list/module.f.cjs')
const { fold } = list
const { compose } = require('../function/module.f.cjs')

/** @typedef {btTypes.Tree<string>} StringSet */

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

module.exports = {
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
