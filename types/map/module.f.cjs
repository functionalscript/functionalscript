const btreeTypes = require('../btree/types/module.f.cjs')
const {
    values,
    find: { value, find },
    set: { set },
    remove: { remove: btreeRemove }
} = require("../btree/module.f.cjs")
const compare = require('../function/compare/module.f.cjs')
const { cmp } = require('../string/module.f.cjs')
const list = require('../list/module.f.cjs')
const { fold } = list
const operator = require('../function/operator/module.f.cjs')

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
 * @typedef {btreeTypes.Tree<Entry<T>>} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => cmp(a)(b)

/** @type {(name: string) => <T>(map: Map<T>) => T|null} */
const at = name => map => {
    if (map === null) { return null }
    const result = value(find(keyCmp(name))(map).first)
    return result === null ? null : result[1]
}

/** @type {<T>(reduce: operator.Reduce<T>) => (entry: Entry<T>) => (map: Map<T>) => Map<T>} */
const setReduceEntry = reduce => entry => set(keyCmp(entry[0]))(old => old === null ? entry : [old[0], reduce(old[1])(entry[1])])

/** @type {<T>(reduce: operator.Reduce<T>) => (name: string) => (value: T) => (map: Map<T>) => Map<T>} */
const setReduce = reduce => name => value => setReduceEntry(reduce)([name, value])

/** @type {<T>(a: T) => (b: T) => T} */
const replace = () => b => b

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
const setReplace = name => value => setReduceEntry(replace)([name, value])

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
const entries = values

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = fold(setReduceEntry(replace))(null)

/** @type {(name: string) => <T>(map: Map<T>) => Map<T>} */
const remove = name => btreeRemove(keyCmp(name))

module.exports = {
    /** @readonly */
    empty: null,
    /** @readonly */
    at,
    /** @readonly */
    setReduce,
    /** @readonly */
    setReplace,
    /** @readonly */
    entries,
    /** @readonly */
    fromEntries,
    /** @readonly */
    remove,
}