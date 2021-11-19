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
 * @template I
 * @template T 
 * @typedef {{
 *  leaf1: (_: I) => (_: Leaf1<T>) => Result<T>
 *  leaf2_v0: (_: I) => (_: Leaf2<T>) => Result<T>
 *  leaf2_v1: (_: I) => (_: Leaf2<T>) => Result<T>
 *  branch3: (_: I) => (_: Branch3<T>) => Result<T>
 *  branch5_v0: (_: I) => (_: Branch5<T>) => Result<T>
 *  branch5_v1: (_: I) => (_: Branch5<T>) => Result<T>
 * }} Found
 */

/**
 * @template I
 * @template T
 * @typedef {{
 *  node3_left: (_: I) => (_: Leaf1<T>) => Result<T>
 *  node3_right: (_: I) => (_: Leaf1<T>) => Result<T>
 *  node5_left: (_: I) => (_: Leaf2<T>) => Result<T>
 *  node5_middle: (_: I) => (_: Leaf2<T>) => Result<T>
 *  node5_right: (_: I) => (_: Leaf2<T>) => Result<T> 
 * }} NotFound
 */

/** 
 * @template I
 * @template T 
 * @typedef {{
 *  leaf1: (_: Index3) => (_: I) => (_: Leaf1<T>) => Result<T>
 *  leaf2: (_: Index5) => (_: I) => (_: Leaf2<T>) => Result<T>
 *  branch3: (_: I) => (_: Branch3<T>) => Result<T>
 *  branch5_v0: (_: I) => (_: Branch5<T>) => Result<T>
 *  branch5_v1: (_: I) => (_: Branch5<T>) => Result<T>
 * }} Visitor
 */

/** @type {<I, T>(visitor: Visitor<I, T>) => (init: I) => (cmp: Cmp<T>) => (node: TNode<T>) => Result<T>} */
const visit = visitor => init => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
    /** @type {(node: TNode<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: { return visitor.leaf1(i3(node[0]))(init)(node) }
            case 2: { return visitor.leaf2(i5(node))(init)(node) }
            case 3: {
                const i = i3(node[1])
                return i === 1 ? visitor.branch3(init)(node) : /* left & right */ todo()
            }
            default: {
                switch (i5([node[1], node[3]])) {
                    case 1: { return visitor.branch5_v0(init)(node) }
                    case 3: { return visitor.branch5_v1(init)(node) }
                    default: { return /* left middle right */ todo() }
                }
            }
        }
    }
    return f
}

