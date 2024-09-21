const { log2x } = require("../bigint/module.f.cjs")

/** @typedef {readonly[Node, bigint, Node]} Branch */

/** @typedef {bigint} Leaf */

/** @typedef {Branch|Leaf} Node */

/** @typedef {Node|null} Trie */

/** @type {(a: bigint) => (b: bigint) => bigint} */
const lsb_cmp = a => b => {
    if (a === b) {
        return 0n
    }
    let i = 0n
    let result = 0n
    while (true) {
        const a0 = a & 1n
        const b0 = b & 1n
        if (a0 !== b0) {
            result |= 1n << i
            return a0 < b0 ? -result : result
        }
        result |= a0 << i
        ++i
        a >>= 1n
        b >>= 1n
    }
}

/** @type {(root: Trie) => (v: bigint) => Node} */
const add = root => v => {
    if (root === null) { return v }
    if (typeof root === 'bigint') {
        const c = lsb_cmp(root)(v)
        return c === 0n ? root
            : c < 0n ? [root, -c, v]
            : [v, c, root]
    }
    const [left, m, right] = root
    const c = lsb_cmp(m)(v)
    if (c < 0n) {
        const nc = -c
        const l = log2x(nc)
        throw 'todo'
    }
    
    throw 'todo'
}

module.exports = {

}