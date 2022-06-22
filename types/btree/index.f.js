const seq = require('../list/index.f.js')
const option = require('../option/index.f.js')

/**
 * @template T
 * @typedef {readonly[T]} Array1
 */

/**
 * @template T
 * @typedef {readonly[T,T]} Array2
 */

/**
 * @template T
 * @typedef {readonly[T,T,T]} Array3
 */

/** @typedef {0|1} Index2 */

/** @typedef {0|1|2} Index3 */

/** @typedef {0|1|2|3|4} Index5 */

//

/**
 * @template T
 * @typedef {Array1<T>} Leaf1
 */

/**
 * @template T
 * @typedef {Array2<T>} Leaf2
 */

/**
 * @template T
 * @typedef {readonly [Node<T>, T, Node<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly [Node<T>, T, Node<T>, T, Node<T>]} Branch5
 */

/**
 * @template T
 * @typedef { Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>} Node
 */

/**
 * @template T
 * @typedef {Node<T> | undefined} Tree
 */

/** @type {<T>(node: Node<T>) => seq.Thunk<T>} */
const nodeValues = node => () => {
    switch (node.length) {
        case 1: case 2: { return node }
        case 3: {
            return seq.flat([
                nodeValues(node[0]),
                [node[1]],
                nodeValues(node[2])
            ])
        }
        default: {
            return seq.flat([
                nodeValues(node[0]),
                [node[1]],
                nodeValues(node[2]),
                [node[3]],
                nodeValues(node[4])
            ])
        }
    }
}

/**
 * @template T
 * @typedef {readonly[Node<T>]} Branch1
 */

/**
 * @template T
 * @typedef { readonly[...Branch5<T>, T, Node<T>] } Branch7
 */

/** @type {<T>(tree: Tree<T>) => seq.List<T>} */
const values = option.map(nodeValues)

module.exports = {
    /** @readonly */
    values,
}
