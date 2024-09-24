const { log2 } = require("../bigint/module.f.cjs")

/** @typedef {bigint} Leaf */

/** @typedef {readonly[TNode, bigint, bigint, TNode]} Branch */

/** @typedef {Branch|Leaf} TNode */

/** @typedef {TNode|null} Root */

/** @type {(root: TNode) => (v: bigint) => TNode} */
const addNode = root => v => {
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
        // `a^b !== 0n` so `h >= 1n`
        const h = log2(a ^ b) + 1n
        return [a, h, b >> h, b]
    }
    const [a, h, p, b] = root
    /** @type {(f: (x: TNode) => TNode) => (x: TNode) => TNode} */
    const addX = f => x => {
        const xN = addNode(x)(v)
        return xN === x ? root : f(x)
    }
    const addA = () => addX(x => [x, h, p, b])(a)
    const addB = () => addX(x => [a, h, p, x])(b)
    if (h === 0n) {
        return v < 0n ? addA() : addB()
    }
    if (v < 0n) {
        // `v` is negative
        throw 'todo'
    }
    if (p < 0n) {
        // `p` is negative
        throw 'todo'
    }
    // h > 0n
    const vp = v >> h
    if (vp === p) {
        const x = 1n << (h - 1n)
        const m = (x << 1n) - 1n
        const mv = v & m
        return mv < x ? addA() : addB()
    }
    // `a^b !== 0n` so `h >= 1n`
    const h2 = log2(vp ^ p) + 1n
    const hN = h2 + h
    return vp < p ? [v, hN, p >> h2, root] : [root, hN, vp >> h2, v]
}

/** @type {(root: Root) => (v: bigint) => TNode} */
const add = root => v => root === null ? v : addNode(root)(v)

module.exports = {
    /** @readonly */
    add
}
