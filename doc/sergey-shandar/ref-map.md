```ts
const empty = (command, key, value) => {
    const ids = new WeakMap()
    let next = 1n
    // A node is `{ entry, zero, one }`; the path to an id is its bits, low first.
    const get = (node, i) =>
        node === undefined ? undefined :
        i === 1n ? node.entry :
        get(i & 1n ? node.one : node.zero, i >> 1n)
    const set = (node, i, e) => {
        const { entry, zero, one } = node ?? {}
        return i === 1n ? { entry: e, zero, one } :
            i & 1n ? { entry, zero, one: set(one, i >> 1n, e) } :
            { entry, zero: set(zero, i >> 1n, e), one }
    }
    const list = node => node === undefined ? [] :
        [...node.entry?.value === undefined ? [] : [node.entry], ...list(node.zero), ...list(node.one)]
    const make = (root, size, order) => (command, key, value) => {
        if (command === 'size') { return size }
        if (command === 'entries') {
            return list(root).toSorted((a, b) => a.order - b.order).map(e => [e.key, e.value])
        }
        const existing = ids.get(key)
        const old = existing === undefined ? undefined : get(root, existing)
        if (command === 'get') { return old?.value }
        if (command !== 'set') { throw command }
        const i = existing ?? next++
        ids.set(key, i)
        const had = old?.value !== undefined
        const entry = { key, value, order: had ? old.order : order }
        return make(set(root, i, entry), size + (value !== undefined) - had, order + 1)
    }
    return make(undefined, 0, 0)(command, key, value)
}
```
