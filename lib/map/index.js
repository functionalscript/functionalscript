const { optionMap } = require("..")
const { getVisitor, setVisitor, values, struct } = require("../tree")

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
 *  readonly struct: () => Iterable<string>
 * }} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const cmp = a => ([b]) => a < b ? -1 : a === b ? 0 : 1

/** @type {<T>(node: TNode<Entry<T>>) => Map<T>} */
const create = node => ({
    get: name => optionMap(([,value]) => value)(getVisitor(cmp(name))(node)),
    set: name => value => { 
        const result = setVisitor(cmp(name))(() => [name, value])(node)
        if ('replace' in result) { return create(result.replace) }
        if ('overflow' in result) { return create(result.overflow) }
        throw ''
    },
    entries: () => values(node),
    struct: () => struct(node),
})

/** 
 * @type {{
 *  readonly get: (name: string) => undefined
 *  readonly set: (name: string) => <T>(value: T) => Map<T>
 *  readonly entries: () => []
 *  readonly struct: () => []
 * }} 
 */
const map = {
    get: () => undefined,
    set: name => value => create([[name, value]]),
    entries: () => [],
    struct: () => [],
}

module.exports = {
    /** @readonly */
    map,
}