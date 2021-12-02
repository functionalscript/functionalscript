const option = require("../option")
const { getVisitor, setVisitor, values } = require("../btree")
const { cmp } = require("../../function/compare")
const seq = require("../sequence")

/** @typedef {import("../../function/compare").Sign} Sign */

/**
 * @template T 
 * @typedef {import("../btree").Leaf1<T>} Leaf1 
 */

/**
 * @template T
 * @typedef {import("../btree").Node<T>} TNode
 */

/**
 * @template T
 * @typedef {import("../../function/compare").Compare<T>} Cmp
 */

/**
 * @template T
 * @typedef {readonly [string, T]} Entry
 */

/**
 * @template T
 * @typedef {{
 *  readonly get: (name: string) => T|undefined
 *  readonly set: (name: string) => (value: T) => Map<T> 
 *  readonly entries: seq.Sequence<Entry<T>>
 *  readonly root: undefined|TNode<Entry<T>>
 * }} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => cmp(a)(b)

/** @type {<T>(node: TNode<Entry<T>>) => Map<T>} */
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
 *  readonly set: (name: string) => <T>(value: T) => Map<T>
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

/** @type {<T>(map: Map<T>) => (entry: Entry<T>) => Map<T>} */
const setOperator = map => ([k, v]) => map.set(k)(v)

/** @type {<T>(entries: seq.Sequence<Entry<T>>) => Map<T>} */
const fromEntries = entries => {
    /** @typedef {typeof entries extends seq.Sequence<Entry<infer T>> ? T : never} T */
    /** @type {Map<T>} */
    const init = empty
    return seq.reduce(setOperator)(init)(entries)
}

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    fromEntries,
}