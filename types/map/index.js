const option = require("../option")
const btree = require('../btree')
const { getVisitor, setVisitor, values } = require("../btree")
const compare = require("../function/compare")
const { stringCmp } = require("../function/compare")
const list = require("../list")

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
    const result = getVisitor(keyCmp(name))(map)
    return result === undefined ? undefined : result[1]
}

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
const set = name => value => map =>  {
    /** @type {Entry<typeof value>} */
    const entry = [name, value]
    if (map === undefined) { return [entry] }
    const result = setVisitor(keyCmp(name))(map)(() => entry)
    switch (result[0]) {
        case 'replace': case 'overflow': { return result[1] }
        default: { throw 'invalid BTree operation' }
    }
}

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
const entries = map => map === undefined ? undefined : values(map)

/** @type {<T>(map: Map<T>) => (entry: Entry<T>) => Map<T>} */
const setOp = map => ([name, value]) => set(name)(value)(map)

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = entries => {
    /** @typedef {typeof entries extends list.List<Entry<infer T>> ? T : never} T */
    return list.reduce(setOp)(/** @type {Map<T>} */(undefined))(entries)
}

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
}