const btTypes = require('../btree/types.f.js')
const btree = require('../btree/index.f.js')
const { values } = require("../btree/index.f.js")
const find = require('../btree/find/index.f.js')
const s = require('../btree/set/index.f.js')
const compare = require('../function/compare/index.f.js')
const { stringCmp } = require('../function/compare/index.f.js')
const list = require('../list/index.f.js')
const btRemove = require('../btree/remove/index.f.js')

/** @typedef {compare.Sign} Sign */

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
 * @typedef {btTypes.Tree<Entry<T>>} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => stringCmp(a)(b)

/** @type {(name: string) => <T>(map: Map<T>) => T|undefined} */
const at = name => map => {
    if (map === undefined) { return undefined }
    const result = find.value(find.find(keyCmp(name))(map).first)
    return result === undefined ? undefined : result[1]
}

/** @type {<T>(entry: Entry<T>) => (map: Map<T>) => Map<T>} */
const setEntry = entry => s.set(keyCmp(entry[0]))(entry)

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
const set = name => value => setEntry([name, value])

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
const entries = values

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = list.reduce(setEntry)(undefined)

/** @type {(name: string) => <T>(map: Map<T>) => Map<T>} */
const remove = name => btRemove.remove(keyCmp(name))

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