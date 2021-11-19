/** @typedef {import('./array').Index3} Index3 */
/** @typedef {import('./array').Index5} Index5 */

/**
 * @template T
 * @typedef {import('./array').Array2<T>} Array2 
 */

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/** @type {<T>(cmp: Cmp<T>) => (value: T) => Index3} */
const index3 = cmp => value => /** @type {Index3} */ (cmp(value) + 1)

/** @type {<T>(cmp: Cmp<T>) => (v2: Array2<T>) => Index5} */
const index5 = cmp => ([v0, v1]) => {
    const i = cmp(v0)
    return /** @type {Index5} */ (i <= 0 ? i + 1 : cmp(v1) + 3)
}

module.exports = {
    /** @readonly */
    index3,
    /** @readonly */
    index5,
}