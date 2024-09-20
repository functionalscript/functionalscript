/** @typedef {readonly[bigint, Node, Node]} Branch */

/** @typedef {bigint} Leaf */

/** @typedef {Branch|Leaf} Node */

/** @typedef {Node|null} Trie */

/** @type {(root: Trie) => (v: bigint) => Node} */
const add = root => v => {
    if (root === null) { return v }
    if (typeof root === 'bigint') 
}

module.exports = {

}