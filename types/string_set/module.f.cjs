const btTypes = require('../btree/types/module.f.mjs')
const btree = require('../btree/module.f.mjs').default
const { find, isFound } = require('../btree/find/module.f.mjs').default
const { remove: btreeRemove } = require('../btree/remove/module.f.mjs').default
const { set: btreeSet } = require('../btree/set/module.f.mjs').default
const {
    /** @type {(s: StringSet) => list.List<string>} */
    values,
    empty,
} = btree
const { cmp } = require("../string/module.f.cjs")
const list = require('../list/module.f.mjs')
const { fold } = list.default
const { compose } = require('../function/module.f.mjs').default

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
