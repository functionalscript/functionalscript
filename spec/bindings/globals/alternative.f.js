/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the function the global would supply, written in the module
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: number, b: number) => number} */
const max = (a, b) => a < b ? b : a;
export default max(1, 2);
