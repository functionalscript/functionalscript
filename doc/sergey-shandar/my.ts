type RefMapKey = object|Function
type RefMapNode = {
    readonly value: unknown,
    readonly zero: RefMapNode,
    readonly one: RefMapNode,
} | undefined
type RefMap = (key: RefMapKey, value?: unknown) => RefMapResult
type RefMapResult = readonly[unknown, RefMap]

const empty: RefMap = (key: RefMapKey, value: unknown) => {
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
        if (i === 1n) { return { value: newValue, zero, one } }
        const ni = i >> 1n
        return i & 1n ? { value, zero, one: set(one, ni, newValue) } :
            { value, zero: set(zero, ni, newValue), one }
    }
    const make = (root: RefMapNode) => {
        const self: RefMap = (key: RefMapKey, value: unknown) => {
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
