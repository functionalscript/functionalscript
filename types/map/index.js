const option = require("../option")
const btree = require('../btree')
const { getVisitor, setVisitor, values } = require("../btree")
const compare = require("../function/compare")
const { cmp } = require("../function/compare")
const seq = require("../sequence")

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
 * @typedef {undefined|TNode<Entry<T>>} MapD
 */

/** @type {<T>(map: MapD<T>) => (name: string) => T|undefined} */
const get = map => name => {
    if (map === undefined) { return undefined }
    const result = getVisitor(keyCmp(name))(map)
    return result === undefined ? undefined : result[1]
}

/**
 * @template T
 * @typedef {{
 *  readonly get: (name: string) => T|undefined
 *  readonly set: (name: string) => (value: T) => MapI<T> 
 *  readonly entries: seq.Sequence<Entry<T>>
 *  readonly root: undefined|TNode<Entry<T>>
 * }} MapI
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => cmp(a)(b)

/** @type {<T>(node: TNode<Entry<T>>) => MapI<T>} */
const create = root => ({
    get: name => option.map(([,value]) => value)(getVisitor(keyCmp(name))(root)),
    set: name => value => {
        const result = setVisitor(keyCmp(name))(() => [name, value])(root)
        switch (result[0]) {
            case 'replace': case 'overflow': { return create(result[1]) }
            default: { throw '' }
        }
    },
    entries: values(root),
    root,
})

/** 
 * @type {{
 *  readonly get: (name: string) => undefined
 *  readonly set: (name: string) => <T>(value: T) => MapI<T>
 *  readonly entries: []
 *  readonly root: undefined
 * }} 
 */
const empty = {
    get: () => undefined,
    set: name => value => create([[name, value]]),
    entries: [],
    root: undefined
}

/** @type {<T>(map: MapI<T>) => (entry: Entry<T>) => MapI<T>} */
const setOperator = map => ([k, v]) => map.set(k)(v)

/** @type {<T>(entries: seq.Sequence<Entry<T>>) => MapI<T>} */
const fromEntries = entries => {
    /** @typedef {typeof entries extends seq.Sequence<Entry<infer T>> ? T : never} T */
    /** @type {MapI<T>} */
    const init = empty
    return seq.reduce(setOperator)(init)(entries)
}

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    fromEntries,
}