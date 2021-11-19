const { todo } = require('..')
const { index3, index5 } = require('./cmp')

/**
 * @template T
 * @typedef {import('./lazy').Lazy<T>} Lazy
 */

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

/** @typedef {import('./array').Index2} Index2 */

/** @typedef {import('./array').Index3} Index3 */

/** @typedef {import('./array').Index5} Index5 */

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
 * @typedef {{
 *  leaf1: <T>(_: Lazy<T>) => (_: Leaf1<T>) => Result<T>
 *  leaf2_v0: <T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>
 *  leaf2_v1: <T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>
 *  branch3: <T>(_: Lazy<T>) => (_: Branch3<T>) => Result<T>
 *  branch5_v0: <T>(_: Lazy<T>) => (_: Branch5<T>) => Result<T>
 *  branch5_v1: <T>(_: Lazy<T>) => (_: Branch5<T>) => Result<T>
 * }} Found
 */

/**
 * @typedef {{
 *  node3_left: <T>(_: Lazy<T>) => (_: Leaf1<T>) => Result<T>
 *  node3_right: <T>(_: Lazy<T>) => (_: Leaf1<T>) => Result<T>
 *  node5_left: <T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>
 *  node5_middle: <T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T>
 *  node5_right: <T>(_: Lazy<T>) => (_: Leaf2<T>) => Result<T> 
 * }} NotFound
 */

/** 
 * @typedef {{
 *  found: Found
 *  notFound: NotFound
 * }} Visitor
 */

/** @type {(visitor: Visitor) => <T>(init: Lazy<T>) => (cmp: Cmp<T>) => (node: TNode<T>) => Result<T>} */
const visit = ({ found, notFound }) => init => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
    /** @type {(node: TNode<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: { 
                switch (i3(node[0])) {
                    case 0: { return notFound.node3_left(init)(node) }
                    case 1: { return found.leaf1(init)(node) }
                    default: { return notFound.node3_right(init)(node) }
                }
            }
            case 2: { 
                switch (i5(node)) {
                    case 0: { return notFound.node5_left(init)(node) }
                    case 1: { return found.leaf2_v0(init)(node) }
                    case 2: { return notFound.node5_middle(init)(node) }
                    case 3: { return found.leaf2_v1(init)(node) }
                    default: { return notFound.node5_right(init)(node) }
                }
            }
            case 3: {
                switch (i3(node[1])) {
                    case 0: { return todo() }
                    case 1: { return found.branch3(init)(node) }
                    default: { return todo() }                    
                }
            }
            default: {
                switch (i5([node[1], node[3]])) {
                    case 0: { return todo() }
                    case 1: { return found.branch5_v0(init)(node) }
                    case 2: { return todo() }
                    case 3: { return found.branch5_v1(init)(node) }
                    default: { return todo() }
                }
            }
        }
    }
    return f
}
