const { todo } = require("..")

/**
 * @template T
 * @typedef {readonly [undefined, T]} Leaf1
 */

/**
 * @template T
 * @typedef {readonly [undefined, T, undefined, T]} Leaf2
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
 * @typedef {Leaf1<T>|Branch3<T>} TNode3
 */

/**
 * @template T
 * @typedef {Leaf2<T>|Branch5<T>} TNode5
 */

/**
 * @template T
 * @typedef {TNode3<T>|TNode5<T>} TNode
 */

/**
 * @template T
 * @typedef {readonly [TNode<T>, T, TNode<T>, T, TNode<T>, T, TNode<T>]} N7
 */

/** @type {<T>(n: N7<T>) => Branch3<T>} */
const split = ([n0, v0, n1, v1, n2, v2, n3]) => [[n0, v0, n1], v1, [n2, v2, n3]]

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/**
 * @template T
 * @typedef {{ done: T|undefined } | { replace: TNode<T> } | { overflow: Branch3<T> }} Result<T>
 */

/**
 * @template T
 * @typedef {[T, T, T]} Array3
 */

/** @typedef {0|1|2} Index3 */

/**
 * @template T
 * @typedef {[T, T, T, T, T]} Array5
 */

/** @typedef {0|1|2|3|4} Index5 */

/**
 * @template T
 * @typedef {{
 *  readonly n3: Array3<(_: TNode3<T>) => Result<T>>
 *  readonly n5: Array5<(_: TNode5<T>) => Result<T>>
 * }} Visitor
 */

/** @type {<T>(cmp: Cmp<T>) => (node3: TNode<T>) => Index3} */
const index3 = cmp => ([,v]) => /** @type {Index3} */ (cmp(v) + 1)

/** @type {<T>(cmp: Cmp<T>) => (node5: TNode5<T>) => Index5} */
const index5 = cmp => ([,v0,,v1]) => {
    const i = cmp(v0)
    return /** @type {Index5} */ (i <= 0 ? i + 1 : cmp(v1) + 3)
}

/** @type {<T>(_: Visitor<T>) => (cmp: Cmp<T>) => (_: TNode<T>) => Result<T>} */
const visit = visitor => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof visitor extends Visitor<infer T> ? T : never} T */
    /** @type {(_: TNode<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 2: case 3: {
                const i = i3(node)
                return visitor.n3[i](node)
            }
            default: {
                const i = i5(node)
                return visitor.n5[i](node)
            }
        }        
    }
    return f
}