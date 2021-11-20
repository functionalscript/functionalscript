const { optionMap } = require("..")
const { getVisitor, setVisitor, values } = require("../tree")

/** @typedef {import("../tree/cmp").Sign} Sign */

/**
 * @template T 
 * @typedef {import("../tree").Leaf1<T>} Leaf1 
 */

/**
 * @template T
 * @typedef {import("../tree").TNode<T>} TNode
 */

/**
 * @template T
 * @typedef {import("../tree/cmp").Cmp<T>} Cmp
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
 *  readonly entries: () => Iterable<Entry<T>>
 *  readonly root: undefined|TNode<Entry<T>>
 * }} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const cmp = a => ([b]) => a < b ? -1 : a === b ? 0 : 1

/** @type {<T>(node: TNode<Entry<T>>) => Map<T>} */
const create = root => ({
    get: name => optionMap(([,value]) => value)(getVisitor(cmp(name))(root)),
    set: name => value => {
        const result = setVisitor(cmp(name))(() => [name, value])(root)
        if ('replace' in result) { return create(result.replace) }
        if ('overflow' in result) { return create(result.overflow) }
        throw ''
    },
    entries: () => values(root),
    root,
})

/** 
 * @type {{
 *  readonly get: (name: string) => undefined
 *  readonly set: (name: string) => <T>(value: T) => Map<T>
 *  readonly entries: () => []
 *  readonly root: undefined
 * }} 
 */
const map = {
    get: () => undefined,
    set: name => value => create([[name, value]]),
    entries: () => [],
    root: undefined
}

module.exports = {
    /** @readonly */
    map,
}