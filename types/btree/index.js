const { todo } = require('../../dev')
const cmp = require('../function/compare')
const seq = require('../list')

/**
 * @template T
 * @typedef {cmp.Compare<T>} Cmp
 */

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
 * @typedef { readonly[...Branch5<T>, T, Node<T>] } Branch7
 */

/** @type {<T>(node: Node<T>) => seq.Thunk<T>} */
const values = node => () => {
    switch (node.length) {
        case 1: case 2: { return node }
        case 3: {
            return seq.flat([
                values(node[0]),
                [node[1]],
                values(node[2])
            ])
        }
        default: {
            return seq.flat([
                values(node[0]),
                [node[1]],
                values(node[2]),
                [node[3]],
                values(node[4])
            ])
        }
    }
}

/**
 * @template T
 * @typedef {readonly[Node<T>]} Branch1
 */

module.exports = {
    /** @readonly */
    values,
}
