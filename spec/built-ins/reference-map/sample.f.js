/**
 * The example of [`README.md`](./README.md) (Finding a Reference) as a
 * function of one number, for the page's WASM demo: two references found in
 * a map, and a third that was never set.
 *
 * @module
 */

/** @type {(key: object, value?: unknown) => readonly [unknown, any]} */
const empty = (key, value) => {
    /** @type {WeakMap<object, bigint>} */
    const ids = new WeakMap()
    let next = 1n
    /** @type {(node: any, i: bigint) => unknown} */
    const get = (node, i) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero
            i >>= 1n
        }
    }
    /** @type {(node: any, i: bigint, newValue: unknown) => unknown} */
    const set = (node, i, newValue) => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    /** @type {(root: unknown) => (key: object, value?: unknown) => readonly [unknown, any]} */
    const make = root => {
        /** @type {(key: object, value?: unknown) => readonly [unknown, any]} */
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
const a = {};
/** @type {readonly unknown[]} */
const b = [];
const [, one] = empty(a, "an object");
const [, two] = one(b, "an array");
/** @type {(...c: readonly number[]) => unknown} */
export default (...c) => two([a, b, {}][Number(c[0])])[0];
