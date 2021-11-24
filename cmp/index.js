const { pipe } = require('../function')

/** @typedef {import('../sequence/array').Index3} Index3 */
/** @typedef {import('../sequence/array').Index5} Index5 */

/**
 * @template T
 * @typedef {import('../sequence/array').Array2<T>} Array2 
 */

/** @typedef {-1|0|1} Sign */

/**
 * @template T
 * @typedef {(_: T) => Sign} Cmp
 */

/** @type {<T>(cmp: Cmp<T>) => (value: T) => Index3} */
const index3 = cmp => value => /** @type {Index3} */ (cmp(value) + 1)

/** @type {<T>(cmp: Cmp<T>) => (v2: Array2<T>) => Index5} */
const index5 = cmp => ([v0, v1]) => /** @type {Index5} */ (
    pipe(cmp(v0)).
    _(i => i <= 0 ? i + 1 : cmp(v1) + 3).
    result)

/** @type {(a: string) => (b: string) => Sign} */
const cmp = a => b => a < b ? -1 : a === b ? 0 : 1

module.exports = {
    /** @readonly */
    index3,
    /** @readonly */
    index5,
    /** @readonly */
    cmp,
}
