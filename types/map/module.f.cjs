const btreeTypes = require('../btree/types/module.f.cjs')
const { values } = require("../btree/module.f.cjs")
const btreeFind = require('../btree/find/module.f.cjs')
const { value, find } = btreeFind
const btreeSet = require('../btree/set/module.f.cjs').set
const compare = require('../function/compare/module.f.cjs')
const { cmp } = require('../string/module.f.cjs')
const list = require('../list/module.f.cjs')
const { fold } = list
const { remove: btreeRemove } = require('../btree/remove/module.f.cjs')
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

/** @type {(name: string) => <T>(map: Map<T>) => T|undefined} */
const at = name => map => {
    if (map === undefined) { return undefined }
    const result = value(find(keyCmp(name))(map).first)
    return result === undefined ? undefined : result[1]
}

/** @type {<T>(o: operator.Reduce<T>) => (entry: Entry<T>) => (map: Map<T>) => Map<T>} */
const setUpdateEntry = o => entry => btreeSet(keyCmp(entry[0]))(old => old === undefined ? entry : [old[0], o(old[1])(entry[1])])

/** @type {<T>(o: operator.Reduce<T>) => (name: string) => (value: T) => (map: Map<T>) => Map<T>} */
const setUpdate = o => name => value => setUpdateEntry(o)([name, value])

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
const setReplace = name => value => setUpdateEntry(replace)([name, value])

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
const entries = values

/** @type {<T>(a: T) => (b: T) => T} */
const replace = () => b => b

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = fold(setUpdateEntry(replace))(undefined)

/** @type {(name: string) => <T>(map: Map<T>) => Map<T>} */
const remove =  name => btreeRemove(keyCmp(name))

module.exports = {
    /** @readonly */
    empty: undefined,
    /** @readonly */
    at,
    /** @readonly */
    setUpdate,
    /** @readonly */
    setReplace,
    /** @readonly */
    entries,
    /** @readonly */
    fromEntries,
    /** @readonly */
    remove,
}