// @ts-self-types="./module.f.d.mts"
import * as Array from '../../array/module.f.mjs'

/** @typedef {Array.Index3} Index3 */
/** @typedef {Array.Index5} Index5 */

/**
 * @template T
 * @typedef {Array.Array2<T>} Array2
 */

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Compare
 */

/** @type {<T>(cmp: Compare<T>) => (value: T) => Index3} */
const index3 = cmp => value => /** @type {Index3} */ (cmp(value) + 1)

/** @type {<T>(cmp: Compare<T>) => (v2: Array2<T>) => Index5} */
const index5 = cmp => ([v0, v1]) => {
    const _0 = cmp(v0)
    return /** @type {Index5} */ (_0 <= 0 ? _0 + 1 : cmp(v1) + 3)
}

/** @type {<T>(a: T) => (b: T) => Sign} */
const unsafeCmp = a => b => a < b ? -1 : a > b ? 1 : 0

export default {
    /** @readonly */
    unsafeCmp,
    /** @readonly */
    index3,
    /** @readonly */
    index5,
}
