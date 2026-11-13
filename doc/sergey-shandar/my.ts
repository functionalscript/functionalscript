type RefMapKey = object|Function
type RefMapNode = {
    readonly value: unknown,
    readonly zero: RefMapNode,
    readonly one: RefMapNode,
} | undefined
const empty = (key: RefMapKey, value: unknown) => {
    const ids = new WeakMap<RefMapKey, bigint>()
    let next = 1n
    // A node is `{ value, zero, one }`; the path to an id is its bits, low first.
    const get = (node: RefMapNode, i: bigint) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero;
            i >>= 1n
        }
    }
    const set = (node: RefMapNode, i: bigint, newValue: unknown): RefMapNode => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    const make = (root: RefMapNode) => {
        const self = (key: RefMapKey, value: unknown) => {
            const existing = ids.get(key)
            const old = existing === undefined ? undefined : get(root, existing)
            if (value === undefined) { return [old, self] }
            const i = existing ?? next++
            ids.set(key, i)
            return [old, make(set(root, i, value))]
        }
        return self
    }
    return make(undefined)(key, value)
}
