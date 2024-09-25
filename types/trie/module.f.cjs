const { log2 } = require("../bigint/module.f.cjs")

/*
 * a < b < c
 * 0   0   1
 * 0   1   0
 *   1  11
 *
 * [[a,b], c]
 *
 * 0   1   1
 * 0   0   1
 *   10  1
 * [a, [b,c]]
 */

/** @typedef {bigint} Leaf1 */

/**
 * `x[0] < x[1]`
 * Conclusion: `log2(x[0]) <= log2(x[1])`
 *
 * `x[1] < x[2]`
 * `H = log2(x[1]) = log2(x[2])`
 * Conclusion: `log2(x[1] ^ x[2]) < H`
 *
 * @typedef {readonly[XNode, bigint, XNode]} XNode
 */

/** @typedef {readonly[bigint, bigint]} Leaf2 */

/** @typedef {readonly[Node1, bigint, Node1]} Node3 */

/** @typedef {Node3|Leaf2|Leaf1} Node1 */

/** @typedef {Node1|null} Root */

/** @type {(a: bigint) => (b: bigint) => bigint} */
const height = a => b => log2(a ^ b) + 1n

/** @type {(node: Node1) => (v: bigint) => bigint} */
const node1Height = node => v => {
    if (typeof node === 'bigint') { height(node)(v) }
    throw 'todo'
}

/** @type {(root: Root) => (v: bigint) => Root} */
const add = root => v => {
    if (root === null) { return v }
    if (typeof root === 'bigint') {
        if (root === v) { return root }
        const [a, b] = root < v ? [root, v] : [v, root]
        return [a, b]
    }
    if (root.length === 2) {
        const [a, b] = root
        if (a === v || b === v) { return root }
        return a < v ? v < b ? [a, v, b] : [a, b, v] : [v, a, b]
    }
    const [a, b, c] = root
    if (v === b) { return root }
    const h = height(b)(v)
    if (b < v) {
    }
    throw 'todo'
}

module.exports = {
    /** @readonly */
    add
}
