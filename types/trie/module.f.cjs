/*
 * [a, b, c]
 *
 * (any of a) < b < (any of c)
 *
 * a ^ b > b ^ c
 */

/** @typedef {bigint} Leaf1 */

/** @typedef {readonly[Node1, bigint, Node1]} Node3 */

/** @typedef {readonly[Node1, bigint]} Node2 */

/** @typedef {Leaf1|Node2|Node3} Node1 */

/** @typedef {Node1|null} Root */

/** @type {(n: Node1) => bigint} */
const middle = n => typeof n === 'bigint' ? n : n[1]

/** @type {(a: bigint) => (b: bigint) => readonly[bigint, bigint]} */
const sort = a => b => a < b ? [a, b] : [b, a]

/** @type {(a: Node1) => (b: bigint) => (c: Root) => Node2|Node3} */
const node = a => b => c => c === null ? [a, b] : [a, b, c]

/** @type {(root: Root) => (v: bigint) => Node1 } */
const add = root => v => {
    if (root === null) { return v }
    if (typeof root === 'bigint') {
        return root === v ? root : sort(root)(v)
    }
    const [a, b] = root
    if (b === v) { return root }
    // a = aa, b = b3
    const c = root.length === 3 ? root[2] : null
    // b0 = 91 b1 = b3
    const [b0, b1] = sort(b)(v)
    // ! 3b < 22
    if ((middle(a) ^ b0) < (b0 ^ b1)) {
        const ab0 = add(a)(b0)
        return ab0 === a ? root : node(ab0)(b1)(c)
    }
    const b1c = add(c)(b1)
    return b1c === c ? root : [a, b0, b1c]
}

module.exports = {
    /** @readonly */
    add
}
