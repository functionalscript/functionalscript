/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the same function, its arguments taken by a rest parameter
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(...p: readonly number[]) => number | undefined} */
const f = (...p) => p[16];
export default f(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);
