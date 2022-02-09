const btree = require('../btree')
const { values } = require("../btree")
const find = require('../btree/find')
const s = require('../btree/set')
const compare = require("../function/compare")
const { stringCmp } = require("../function/compare")
const list = require("../list")
const btRemove = require("../btree/remove")

/** @typedef {compare.Sign} Sign */

/**
 * @template T
 * @typedef {btree.Leaf1<T>} Leaf1
 */

/**
 * @template T
 * @typedef {btree.Node<T>} TNode
 */

/**
 * @template T
 * @typedef {compare.Compare<T>} Cmp
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/**
 * @template T
 * @typedef {undefined|TNode<Entry<T>>} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => stringCmp(a)(b)

/** @type {(name: string) => <T>(map: Map<T>) => T|undefined} */
const at = name => map => {
    if (map === undefined) { return undefined }
    const result = find.value(find.find(keyCmp(name))(map).first)
    return result === undefined ? undefined : result[1]
}

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
const set = name => value => map =>  {
    /** @type {Entry<typeof value>} */
    const entry = [name, value]
    if (map === undefined) { return [entry] }
    return s.set(keyCmp(name))(entry)(map)
}

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
const entries = values

/** @type {<T>(map: Map<T>) => (entry: Entry<T>) => Map<T>} */
const setOp = map => ([name, value]) => set(name)(value)(map)

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = entries => list.reduce
    (setOp)
    (/** @type {typeof entries extends list.List<Entry<infer T>> ? Map<T> : never} */(undefined))
    (entries)

/** @type {(name: string) => <T>(map: Map<T>) => Map<T>} */
const remove = name => map => map === undefined ? undefined : btRemove.remove(keyCmp(name))(map)

module.exports = {
    /** @readonly */
    empty: undefined,
    /** @readonly */
    at,
    /** @readonly */
    set,
    /** @readonly */
    entries,
    /** @readonly */
    fromEntries,
    /** @readonly */
    remove,
}