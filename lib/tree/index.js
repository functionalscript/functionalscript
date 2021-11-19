const { todo } = require('..')
const { index3, index5 } = require('./cmp')

/**
 * @template T
 * @typedef {import('./cmp').Cmp<T>} Cmp
 */

/**
 * @template T
 * @typedef {import('./array').Array1<T>} Array1
 */

/**
 * @template T
 * @typedef {import('./array').Array2<T>} Array2
 */

/**
 * @template T
 * @typedef {import('./array').Array3<T>} Array3
 */

/**
 * @template T
 * @typedef {import('./array').Array5<T>} Array5
 */

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
 * @typedef {readonly [TNode<T>, T, TNode<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly [TNode<T>, T, TNode<T>, T, TNode<T>]} Branch5
 */

/**
 * @template T
 * @typedef {Leaf1<T>|Leaf2<T>|Branch3<T>|Branch5<T>} TNode
 */

/**
 * @template T
 * @typedef {{ done: T | undefined }} Done
 */

/**
 * @template T
 * @typedef {{ replace: TNode<T> }} Replace
 */

/**
 * @template T
 * @typedef {Done<T> | Replace<T> | { overflow: Branch3<T> }} Result
 */

/**
 * @template T
 * @typedef {{
 *  readonly leaf1: Array3<(_: Leaf1<T>) => Result<T>>
 *  readonly leaf2: Array5<(_: Leaf2<T>) => Result<T>> 
 * }} Visitor
 */

/**
 * @template T
 * @typedef {{
 *  readonly node3: Array3<(_: Branch3<T>) => Result<T>>
 *  readonly node5: Array5<(_: Branch5<T>) => Result<T>>
 * }} MergeVisitor
 */

/** @type {<T>(value: T) => MergeVisitor<T>} */
// const mergeVisitor = value => ({
//     node3: []
//     node5: []
// })

/** @type {<T>(visitor: Visitor<T>) => (cmp: Cmp<T>) => (node: TNode<T>) => Result<T>} */
const visit = ({ leaf1, leaf2 }) => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
    /** @type {(node: TNode<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: { return leaf1[i3(node[0])](node) }
            case 2: { return leaf2[i5(node)](node) }
            case 3: {
                i3(node[1])
                return todo()
            }
            default: {
                i5([node[1], node[3]])
                return todo()
            }
        }
    }
    return f
}

// leaf1:
// - left
// - found
// - right
// leaf2:
// - left
// - found0
// - middle
// - found1
// - right
// branch3:
// - left
// - found
// - right
// branch5:
// - left

// const notFound = () => ({ done: undefined })

// /** @type {<T>(_: readonly [T, T?]) => Done<T>} */
// const found0 = ([done]) => ({ done })

// /** @type {Visitor<any>} */
// const searchVisitor = {
//     leaf1: [notFound, found0, notFound],
//     leaf2: [notFound, found0, notFound, ([,done]) => ({ done }), notFound]
// }

// /** @type {<T>(cmp: Cmp<T>) => (node: TNode<T>) => Result<T>} */
// const search = visit(searchVisitor)

// /** @type {<T>(value: T) => Visitor<T>} */
// const replaceVisitor = value => ({
//     leaf1: [notFound, () => ({ replace: [value] }), notFound],
//     leaf2: [
//         notFound, 
//         ([,v1]) => ({ replace: [value, v1] }), 
//         notFound, 
//         ([v0]) => ({ replace: [v0, value]}), 
//         notFound
//     ]
// })
