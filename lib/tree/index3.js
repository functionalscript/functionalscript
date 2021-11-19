/**
 * @template T
 * @typedef {T|undefined} O<T>
 */

const { todo } = require("..")

/**
 * @template T
 * @typedef {readonly [true, O<T>, T, O<T>]} Leaf3
 */

/**
 * @template T
 * @typedef {readonly [true, O<T>, T, O<T>, T, O<T>]} Leaf5
 */

/**
 * @template T
 * @typedef {readonly [false, TNode<T>, T, TNode<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly [false, TNode<T>, T, TNode<T>, T, TNode<T>]} Branch5
 */

/**
 * @template T
 * @typedef {Leaf3<T>|Branch3<T>} TNode3
 */

/**
 * @template T
 * @typedef {Leaf5<T>|Branch5<T>} TNode5
 */

/**
 * @template T
 * @typedef {TNode3<T>|TNode5<T>} TNode
 */

/**
 * @template T 
 * @typedef {readonly [T,T,T]} Array3
 */

/** @typedef {0|1|2} Index3 */

/**
 * @template T
 * @typedef {readonly [T,T,T,T,T]} Array5
 */

/**
 * @template T
 * @typedef {{ done: T|undefined } | { replace: TNode<T> } | { overflow: TNode3<T> }} Result<T>
 */

/**
 * @template T
 * @typedef {{
 *  readonly node3: Array3<(node: TNode3<T>) => Result<T>>
 *  readonly node5: Array5<(node: TNode5<T>) => Result<T>>
 * }} Visitor
 */

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/** @type {<T>(visitor: Visitor<T>) => (cmp: Cmp<T>) => (node: TNode<T>) => Result<T>} */
const visit = visitor => cmp => {
    /** @typedef {typeof visitor extends Visitor<infer T> ? T : never} T */
    /** @type {(node: TNode<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 4: return visitor.node3[0](node)
            default: return visitor.node5[0](node)
        }
    }
    return f
}
