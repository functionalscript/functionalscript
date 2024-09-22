/** @typedef {bigint} Leaf */

const { log2 } = require("../bigint/module.f.cjs")

/** @typedef {readonly[TNode, bigint, bigint, TNode]} Branch */

/** @typedef {Branch|Leaf} TNode */

/** @typedef {TNode|null} Root */

/** @type {(root: Root) => (v: bigint) => TNode} */
const add = root => v => {
    if (root === null) { return v }
    if (typeof root === 'bigint') {
        if (root === v) { return root }
        const [a, b] = root < v ? [root, v] : [v, root]
        if (b < 0n) {
            // a and b are negative.
            throw 'todo'
        }
        if (a < 0n) {
            // a is negative, b is not negative.
            return [a, 0n, 0n, b]
        }
        // `d` defines a difference. Note: a !== b so d !== 0n
        const d = a ^ b
        // 1..
        const h = log2(d) + 1n
        return [a, h, b >> h, b]
    }
    const [a, h, p, b] = root
    if (v < 0n) {
        //
        throw 'todo'
    }
    
    throw 'todo'
}

module.exports = {
    /** @readonly */
    add
}
