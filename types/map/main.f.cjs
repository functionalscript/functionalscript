const btTypes = require('../btree/types/main.f.cjs')
const btree = require('../btree/main.f.cjs')
const { values } = require("../btree/main.f.cjs")
const find = require('../btree/find/main.f.cjs')
const s = require('../btree/set/main.f.cjs')
const compare = require('../function/compare/main.f.cjs')
const { stringCmp } = require('../function/compare/main.f.cjs')
const list = require('../list/main.f.cjs')
const btRemove = require('../btree/remove/main.f.cjs')

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