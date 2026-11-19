/**
 * The empty reference map
 * ([reference map](../../../spec/built-ins/reference-map/README.md)): the language's one
 * way to find a reference faster than a scan with `===`. A map is a
 * function. `m(key)` answers `[current, m]`, the value last set for `key`
 * in `m` or `undefined`, and the same map; `m(key, value)` answers
 * `[previous, m1]`, a new map with `key` set to `value`, leaving `m` as it
 * was. A `value` of `undefined` is no value, so that call is a read, and a
 * key cannot be set back to `undefined`. Keys are compared as `===`
 * compares references. A primitive is never a key: reading one answers
 * `undefined`, and setting one throws. A call takes `O(log n)` steps on
 * every map, an older one included, where `n` is the number of distinct
 * keys set since `empty`.
 *
 * It is only a mapping: no size, no iteration and no removal. A program
 * keeps its data in a container of its own, under a key the map gives a
 * reference — `m(key, next)` answers the key it already has or assigns
 * `next`.
 *
 * Written once here and imported: the compiler reads this very text as the
 * EDAG's `['refMap']`, and a module that spells its own gets a map of its
 * own, which is what JavaScript gives it too. The mutation inside is not
 * observable; the body is admitted whole, and admits no `WeakMap`, no
 * captured `let` and no assignment anywhere else.
 *
 * The ids are sequential, so the binary trie over their bits stays
 * balanced without rebalancing, and they never leave the function.
 *
 * @module
 *
 * @import { RefMap, RefMapKey } from './types.ts'
 * @import { _RefMapNode } from './private.ts'
 */

/** @type {RefMap} */
export const empty = (key, value) => {
    /** @type {WeakMap<RefMapKey, bigint>} */
    const ids = new WeakMap()
    let next = 1n
    // A node is `{ value, zero, one }`; the path to an id is its bits, low first.
    /** @type {(node: _RefMapNode, i: bigint) => unknown} */
    const get = (node, i) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero
            i >>= 1n
        }
    }
    /** @type {(node: _RefMapNode, i: bigint, newValue: unknown) => _RefMapNode} */
    const set = (node, i, newValue) => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    /** @type {(root: _RefMapNode) => RefMap} */
    const make = root => {
        /** @type {RefMap} */
        const self = (key, value) => {
            const existing = ids.get(key)
            const old = existing === undefined ? undefined : get(root, existing)
            if (value === undefined) { return [old, self] }
            const i = existing ?? next
            if (existing === undefined) { next += 1n }
            ids.set(key, i)
            return [old, make(set(root, i, value))]
        }
        return self
    }
    return value === undefined ? [undefined, empty] : make(undefined)(key, value)
}
