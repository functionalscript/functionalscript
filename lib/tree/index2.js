const { todo } = require("..")

/**
 * @template T
 * @typedef {readonly [T]} V1
 */

/**
 * @template T
 * @typedef {readonly [T, T]} V2
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>]} N3
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>, T, N<T>]} N5
 */

/**
 * @template T
 * @typedef {V1<T> | V2<T> | N3<T> | N5<T>} N
 */

/**
 * @template T
 * @typedef {readonly [N<T>, T, N<T>, T, N<T>, T, N<T>]} N7
 */

/** @type {<T>(n: N7<T>) => N3<T>} */
const split = ([n0, v0, n1, v1, n2, v2, n3]) => [[n0, v0, n1], v1, [n2, v2, n3]]

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/**
 * @template T
 * @typedef {{ done: T|undefined } | { replace: N<T> } | { overflow: N3<T> }} Result<T>
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
 *  readonly v1: Array3<(_: V1<T>) => Result<T>>
 *  readonly v2: Array5<(_: V2<T>) => Result<T>>
 *  readonly n3: Array3<(_: N3<T>) => Result<T>>
 *  readonly n5: Array5<(_: N5<T>) => Result<T>> 
 * }} Visitor
 */

/** @type {<T>(cmp: Cmp<T>) => (value: T) => Index3} */
const index3 = cmp => value => /** @type {Index3} */ (cmp(value) + 1)

/** @type {<T>(cmp: Cmp<T>) => (v2: V2<T>) => Index5} */
const index5 = cmp => ([v0, v1]) => {
    const i = cmp(v0)
    return /** @type {Index5} */ (i <= 0 ? i + 1 : cmp(v1) + 3)
}

/** @type {<T>(_: Visitor<T>) => (cmp: Cmp<T>) => (_: N<T>) => Result<T>} */
const visit = visitor => cmp => {
    const i3 = index3(cmp)
    const i5 = index5(cmp)
    /** @typedef {typeof visitor extends Visitor<infer T> ? T : never} T */
    /** @type {(_: N<T>) => Result<T>} */
    const f = node => {
        switch (node.length) {
            case 1: return visitor.v1[i3(node[0])](node)
            case 2: return visitor.v2[i5(node)](node)
            case 3: return visitor.n3[i3(node[1])](node)
            default: return visitor.n5[i5([node[1], node[3]])](node)
        }        
    }
    return f
}